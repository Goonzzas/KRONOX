/** Coalesce identical cutouts and limit concurrent downloads/decodes. Each subscriber can cancel independently. */
export class SharedFrameLoads {
  constructor(limit = 2) {
    this.limit = limit;
    this.active = 0;
    this.pending = new Map();
    this.queue = [];
  }
  get(key, loader, signal) {
    if (signal?.aborted) return Promise.reject(Error('Carga cancelada.'));
    let task = this.pending.get(key);
    if (task?.controller.signal.aborted) task = null;
    if (!task) {
      const controller = new AbortController();
      let resolve, reject;
      const promise = new Promise((a, b) => {
        resolve = a;
        reject = b;
      });
      task = { key, loader, controller, promise, resolve, reject, users: 0 };
      this.pending.set(key, task);
      this.queue.push(task);
      this.drain();
    }
    task.users++;
    return new Promise((resolve, reject) => {
      let done = false;
      const settle = (error, value) => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', abort);
        task.users--;
        if (!task.users && !task.finished && this.pending.get(key) === task)
          task.controller.abort();
        if (error) reject(error);
        else resolve(value);
      };
      const abort = () => settle(Error('Carga cancelada.'));
      signal?.addEventListener('abort', abort, { once: true });
      task.promise.then(
        (value) => settle(null, value),
        (error) => settle(error),
      );
    });
  }
  drain() {
    while (this.active < this.limit && this.queue.length) {
      const task = this.queue.shift();
      if (task.controller.signal.aborted) {
        if (this.pending.get(task.key) === task) this.pending.delete(task.key);
        task.reject(Error('Carga cancelada.'));
        continue;
      }
      this.active++;
      Promise.resolve()
        .then(() => {
          if (task.controller.signal.aborted) throw Error('Carga cancelada.');
          return task.loader(task.controller.signal);
        })
        .then(
          (value) => {
            task.finished = true;
            task.resolve(value);
          },
          (error) => {
            task.finished = true;
            task.reject(error);
          },
        )
        .finally(() => {
          this.active--;
          if (this.pending.get(task.key) === task) this.pending.delete(task.key);
          this.drain();
        });
    }
  }
  clear() {
    for (const task of this.pending.values()) task.controller.abort();
  }
}
