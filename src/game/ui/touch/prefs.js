// Touch settings, kept in their own localStorage key so the main save format is untouched.
//   show:   null = automatic (coarse pointer), true = always, false = never
//   button: button size scale (0.8 .. 1.4), stick: stick size scale (0.8 .. 1.4)
//   left:   left-handed layout (stick on the right, buttons on the left)
import { local } from "@/game/core/safeStorage";
const KEY = "scrapwake.touch";
export const TOUCH_DEFAULTS = { show: null, button: 1, stick: 1, left: false };
const listeners = new Set();
let cache = null;

export function getTouchPrefs() {
  if (cache) return cache;
  cache = { ...TOUCH_DEFAULTS };
  try {
    const raw = JSON.parse(local.get(KEY) || "null");
    if (raw && typeof raw === "object") {
      if (raw.show === true || raw.show === false || raw.show === null) cache.show = raw.show;
      if (typeof raw.button === "number") cache.button = Math.min(1.4, Math.max(0.8, raw.button));
      if (typeof raw.stick === "number") cache.stick = Math.min(1.4, Math.max(0.8, raw.stick));
      cache.left = !!raw.left;
    }
  } catch { /* private mode: defaults */ }
  return cache;
}

export function setTouchPrefs(patch) {
  cache = { ...getTouchPrefs(), ...patch };
  try { local.set(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  for (const fn of listeners) fn(cache);
  return cache;
}

export function onTouchPrefs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}