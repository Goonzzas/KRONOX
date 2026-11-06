const STORAGE_KEY = 'kronox-overlay-layout-v1';

const SELECTORS = [
  '.kronoxSubtitleDock',
  '.kronoxDiegeticConsole',
  '.kronoxProximityPrompt',
  '.kronoxCabinSpatialCompass',
  '.kronoxRealTimeIntroHud',
  '.missionLaunchWindow',
  '.kronoxNotice',
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

function readPositions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writePositions(positions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    /* Keep panel movement available for this session if storage is disabled. */
  }
}

function panelKey(element) {
  return SELECTORS.find((selector) => element.matches(selector))?.slice(1);
}

function applyPosition(element, position) {
  const maxLeft = Math.max(8, window.innerWidth - element.offsetWidth - 8);
  const maxTop = Math.max(8, window.innerHeight - element.offsetHeight - 8);
  element.dataset.userPositioned = 'true';
  element.style.left = `${clamp(position.x * maxLeft, 8, maxLeft)}px`;
  element.style.top = `${clamp(position.y * maxTop, 8, maxTop)}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.transform = 'none';
};

export function installFloatingOverlayLayout() {
  const positions = readPositions();
  const handles = new WeakMap();
  let activeDrag = null;

  const attach = (element) => {
    if (handles.has(element)) return;
    const key = panelKey(element);
    if (!key) return;

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'kronoxMoveHandle';
    handle.textContent = 'Mover';
    handle.setAttribute('aria-label', 'Mover este panel. Doble clic para restaurar su posición.');
    handle.title = 'Arrastra para mover · doble clic para restaurar';
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.transform = 'none';
      element.dataset.userPositioned = 'true';
      activeDrag = {
        element,
        handle,
        key,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
      };
      handle.setPointerCapture(event.pointerId);
      element.classList.add('is-moving');
    });
    handle.addEventListener('pointermove', (event) => {
      if (!activeDrag || activeDrag.handle !== handle || activeDrag.pointerId !== event.pointerId)
        return;
      const maxLeft = Math.max(8, window.innerWidth - element.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - element.offsetHeight - 8);
      const left = clamp(activeDrag.left + event.clientX - activeDrag.startX, 8, maxLeft);
      const top = clamp(activeDrag.top + event.clientY - activeDrag.startY, 8, maxTop);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    });
    const finishDrag = (event) => {
      if (!activeDrag || activeDrag.handle !== handle || activeDrag.pointerId !== event.pointerId)
        return;
      const rect = element.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - element.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - element.offsetHeight - 8);
      positions[key] = {
        x: rect.left / maxLeft,
        y: rect.top / maxTop,
      };
      writePositions(positions);
      element.classList.remove('is-moving');
      activeDrag = null;
    };
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
    handle.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      delete positions[key];
      writePositions(positions);
      element.classList.remove('is-moving');
      element.removeAttribute('data-user-positioned');
      element.style.removeProperty('left');
      element.style.removeProperty('top');
      element.style.removeProperty('right');
      element.style.removeProperty('bottom');
      element.style.removeProperty('transform');
    });
    element.appendChild(handle);
    handles.set(element, handle);

    if (positions[key]) applyPosition(element, positions[key]);
  };

  const scan = () => SELECTORS.forEach((selector) => document.querySelectorAll(selector).forEach(attach));
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });

  const onResize = () => {
    SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        const key = panelKey(element);
        if (positions[key]) applyPosition(element, positions[key]);
      });
    });
  };
  window.addEventListener('resize', onResize);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    if (activeDrag) activeDrag.element.classList.remove('is-moving');
  };
}
