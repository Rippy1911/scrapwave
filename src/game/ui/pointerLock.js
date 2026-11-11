// Pointer lock only from a click on the canvas, and only while playing. Failures are fine (WrongDocumentError in
// embedded previews): aim then follows the mouse position instead.
export function lockPointer(c, playing) {
  if (!c || !c.isConnected || !playing || document.pointerLockElement === c) return;
  try {
    const r = c.requestPointerLock?.();
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch {
    // mouse-position aiming keeps working
  }
}