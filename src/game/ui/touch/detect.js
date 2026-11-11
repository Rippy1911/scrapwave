// Touch detection. Browser-only: call from effects / handlers, never at module scope or in render.
// ?touch=1 forces touch controls on (desktop testing), ?touch=0 forces them off.
// Otherwise a coarse primary pointer (phones, tablets) turns them on.

export function touchParam() {
  try {
    const v = new URLSearchParams(window.location.search).get("touch");
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
  } catch { /* no window */ }
  return null;
}

export function isCoarsePointer() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && window.matchMedia("(hover: none)").matches);
}

// A phone-ish device: coarse pointer or forced by ?touch=1. Used for the Low quality default.
export function isMobileDevice() {
  const p = touchParam();
  if (p !== null) return p;
  return isCoarsePointer();
}

// Whether to show the touch controls. `show` is the Settings toggle (undefined = automatic).
export function wantTouch(show) {
  const p = touchParam();
  if (p !== null) return p;
  if (show === false) return false;
  if (show === true) return true;
  return isCoarsePointer();
}

export function isPortrait() {
  return window.innerHeight > window.innerWidth;
}