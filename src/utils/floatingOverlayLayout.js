const STORAGE_KEY = 'kronox-overlay-layout-v1';
const DRAG_THRESHOLD = 5;

const SELECTORS = [
  '.kronoxSubtitleDock',
  '.kronoxDiegeticConsole',
  '.kronoxProximityPrompt',
  '.kronoxCabinSpatialCompass',
  '.kronoxRealTimeIntroHud',
  '.missionLaunchWindow',
  '.kronoxNotice',
  '.kronoxDialogueCard',
];

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'summary',
  '[role="button"]',
  '[contenteditable="true"]',
  '[data-no-drag]',
].join(',');

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

function viewportLimits(element) {
  return {
    maxLeft: Math.max(8, window.innerWidth - element.offsetWidth - 8),
    maxTop: Math.max(8, window.innerHeight - element.offsetHeight - 8),
  };
}

function applyPosition(element, position) {
  const { maxLeft, maxTop } = viewportLimits(element);
  element.dataset.userPositioned = 'true';
  element.style.left = `${clamp(position.x * maxLeft, 8, maxLeft)}px`;
  element.style.top = `${clamp(position.y * maxTop, 8, maxTop)}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.transform = 'none';
}

function clearPosition(element, key, positions) {
  delete positions[key];
  writePositions(positions);
  element.classList.remove('is-moving');
  element.removeAttribute('data-user-positioned');
  element.style.removeProperty('left');
  element.style.removeProperty('top');
  element.style.removeProperty('right');
  element.style.removeProperty('bottom');
  element.style.removeProperty('transform');
}

export function installFloatingOverlayLayout() {
  const positions = readPositions();
  const attached = new WeakSet();
  let activeDrag = null;

  const moveActivePanel = (event) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - activeDrag.startX;
    const deltaY = event.clientY - activeDrag.startY;
    if (!activeDrag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    const { element } = activeDrag;
    if (!activeDrag.moved) {
      activeDrag.moved = true;
      element.classList.add('is-moving');
      element.style.left = `${activeDrag.left}px`;
      element.style.top = `${activeDrag.top}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.transform = 'none';
      element.dataset.userPositioned = 'true';
    }

    event.preventDefault();
    const { maxLeft, maxTop } = viewportLimits(element);
    element.style.left = `${clamp(activeDrag.left + deltaX, 8, maxLeft)}px`;
    element.style.top = `${clamp(activeDrag.top + deltaY, 8, maxTop)}px`;
  };

  const finishActivePanelDrag = (event) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const { element, key, moved } = activeDrag;
    if (moved) {
      const rect = element.getBoundingClientRect();
      const { maxLeft, maxTop } = viewportLimits(element);
      positions[key] = {
        x: clamp(rect.left / maxLeft, 0, 1),
        y: clamp(rect.top / maxTop, 0, 1),
      };
      writePositions(positions);
      element.classList.remove('is-moving');
    }
    activeDrag = null;
  };

  const attach = (element) => {
    if (attached.has(element)) return;
    const key = panelKey(element);
    if (!key) return;

    element.dataset.draggablePanel = 'true';
    element.title ||= 'Arrastra desde cualquier parte del panel para moverlo · doble clic para restaurar';

    element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.isPrimary === false) return;
      if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) return;

      event.preventDefault();
      const rect = element.getBoundingClientRect();
      activeDrag = {
        element,
        key,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false,
      };
      element.setPointerCapture?.(event.pointerId);
    });
    element.addEventListener('lostpointercapture', finishActivePanelDrag);
    element.addEventListener('dblclick', (event) => {
      if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) return;
      event.preventDefault();
      clearPosition(element, key, positions);
    });
    attached.add(element);

    if (positions[key]) applyPosition(element, positions[key]);
  };

  const scan = () => SELECTORS.forEach((selector) => document.querySelectorAll(selector).forEach(attach));
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pointermove', moveActivePanel, { passive: false });
  window.addEventListener('pointerup', finishActivePanelDrag);
  window.addEventListener('pointercancel', finishActivePanelDrag);

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
    window.removeEventListener('pointermove', moveActivePanel);
    window.removeEventListener('pointerup', finishActivePanelDrag);
    window.removeEventListener('pointercancel', finishActivePanelDrag);
    window.removeEventListener('resize', onResize);
    if (activeDrag) activeDrag.element.classList.remove('is-moving');
  };
}
