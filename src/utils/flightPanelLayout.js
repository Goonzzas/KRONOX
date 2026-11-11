/** Keep the map and flight controls below the actual bridge bar, including wrapped text and resized viewports. */
export function installFlightPanelLayout() {
  const root = document.querySelector('.app');
  if (!root?.style?.setProperty) return () => {};
  let header = null,
    lastBottom = -1;
  const measure = () => {
    const next = document.querySelector('.kronoxBridgeTopBar');
    if (next !== header) {
      resize?.disconnect();
      header = next;
      if (header) resize?.observe(header);
    }
    const bottom = Math.max(86, Math.ceil((header?.getBoundingClientRect().bottom || 62) + 14));
    if (bottom !== lastBottom) {
      lastBottom = bottom;
      root.style.setProperty('--flight-hud-bottom', bottom + 'px');
    }
  };
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure),
    mutation = typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure);
  mutation?.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', measure);
  measure();
  return () => {
    resize?.disconnect();
    mutation?.disconnect();
    window.removeEventListener('resize', measure);
    root.style.removeProperty('--flight-hud-bottom');
  };
}
