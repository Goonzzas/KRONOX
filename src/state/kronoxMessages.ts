export type NarrativeIntent =
  | 'welcome'
  | 'explanation'
  | 'orientation'
  | 'confirmation'
  | 'response'
  | 'warning';

export type NarrativeMessage = {
  readonly channel: 'narration';
  readonly id: string;
  readonly text: string;
  readonly intent: NarrativeIntent;
  readonly priority: number;
  readonly once: boolean;
  readonly suggestedAction?: string;
  readonly completionCondition?: string;
};

export type ObjectiveMessage = {
  readonly channel: 'objective';
  readonly id: string;
  readonly text: string;
  readonly completionCondition?: string;
};

export type TelemetryUpdate = {
  readonly channel: 'telemetry';
  readonly id: string;
  readonly values: Readonly<Record<string, number | string | boolean>>;
};

export type DebugEvent = {
  readonly channel: 'debug';
  readonly id: string;
  readonly event: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

let messageSequence = 0;
export function createNarrativeMessage(
  text: string,
  options: Partial<Omit<NarrativeMessage, 'channel' | 'id' | 'text'>> & { id?: string } = {},
): NarrativeMessage {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('Narrative messages require non-empty text.');
  return Object.freeze({
    channel: 'narration',
    id: options.id || `narrative-${++messageSequence}`,
    text: cleanText,
    intent: options.intent || 'explanation',
    priority: options.priority ?? 0,
    once: options.once ?? false,
    ...(options.suggestedAction ? { suggestedAction: options.suggestedAction } : {}),
    ...(options.completionCondition ? { completionCondition: options.completionCondition } : {}),
  });
}

export class NarrativeQueue {
  private activeMessage: NarrativeMessage | null = null;
  private readonly pending: NarrativeMessage[] = [];
  private readonly consumedOnce = new Set<string>();
  private lastMessage: NarrativeMessage | null = null;
  private isPaused = false;
  private listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.activeMessage;
  readonly getServerSnapshot = () => this.activeMessage;
  readonly isSpeechPaused = () => this.isPaused;
  readonly getLastMessage = () => this.lastMessage;

  enqueue(message: NarrativeMessage): boolean {
    if (message.channel !== 'narration') throw new Error('Only NarrativeMessage can enter the dialogue queue.');
    if (message.once && this.consumedOnce.has(message.id)) return false;
    if (message.once) this.consumedOnce.add(message.id);
    if (!this.activeMessage) {
      this.activeMessage = message;
      this.lastMessage = message;
    }
    else {
      this.pending.push(message);
      this.pending.sort((a, b) => b.priority - a.priority);
    }
    this.emit();
    return true;
  }

  replaceActive(message: NarrativeMessage): boolean {
    if (message.channel !== 'narration') throw new Error('Only NarrativeMessage can enter the dialogue queue.');
    if (message.once && this.consumedOnce.has(message.id)) return false;
    if (message.once) this.consumedOnce.add(message.id);
    this.activeMessage = message;
    this.lastMessage = message;
    this.pending.length = 0;
    this.emit();
    return true;
  }

  complete(id: string): void {
    if (!this.activeMessage || this.activeMessage.id !== id || this.isPaused) return;
    this.activeMessage = this.pending.shift() || null;
    if (this.activeMessage) this.lastMessage = this.activeMessage;
    this.emit();
  }

  pause(): void {
    this.isPaused = true;
    this.emit();
  }

  resume(): void {
    this.isPaused = false;
    this.emit();
  }

  repeat(): NarrativeMessage | null {
    return this.lastMessage;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const narrativeQueue = new NarrativeQueue();

export function logDebugEvent(event: DebugEvent): void {
  if (import.meta.env.DEV && event.channel === 'debug') {
    console.debug(`[KRONOX:${event.event}]`, event.details || {});
  }
}
