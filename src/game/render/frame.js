// Shared render context: the camera and quality preset, per-frame hooks (LOD swaps, atmosphere) and
// quality listeners. World and vehicle code registers here so it never needs the game object.
// Hooks are scoped to a scene: React dev mode builds two games at once and disposes one, and its cleanup must
// not remove the hooks of the game that stays.
export const RC = { camera: null, q: null, quality: "high", time: 0, renderer: null, scene: null };

const frameHooks = new Set();
const qualityHooks = new Set();

/** fn(camera, dt, time) every rendered frame of `scene` (or of any scene when scene is null). Returns an unsubscribe. */
export function onFrame(fn, scene = null) {
  const h = { fn, scene };
  frameHooks.add(h);
  return () => frameHooks.delete(h);
}
export function onQuality(fn) { qualityHooks.add(fn); if (RC.q) fn(RC.q); return () => qualityHooks.delete(fn); }

export function runFrameHooks(dt, scene = null, camera = RC.camera) {
  RC.time += dt;
  for (const h of frameHooks) if (!h.scene || h.scene === scene) h.fn(camera, dt, RC.time);
}
export function setRenderQuality(name, q) {
  RC.quality = name; RC.q = q;
  for (const fn of qualityHooks) fn(q);
}
export function clearRenderHooks(scene) { for (const h of frameHooks) if (h.scene === scene) frameHooks.delete(h); }
