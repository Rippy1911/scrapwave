// On-foot keys, read here instead of core/input.js: held state comes from input.held(code); press edges are
// computed once per simulation step in tick(), so a press is seen exactly once.
//   E      get out (stopped, in a safe zone) / get in / use the building in front of you
//   W A S D walk · Shift run · Space jump · mouse turns the camera
//   Z      summon one of your own vehicles from the garage (on foot, in a safe zone)
//   1 2    long gun / sidearm · 3 grenades · 4 C4 · R reload (C4: blow the charges) · Q scope zoom step
//   LMB    fire or throw (also J, pad X, the touch fire button) · RMB aim (pad: left trigger)
export const FOOT_KEYS = ["KeyE", "KeyZ", "Space", "Digit1", "Digit2", "Digit3", "Digit4", "KeyR", "KeyQ"];

export function createFootKeys(input) {
  const prev = {}, edge = {};
  const fire = () => !!input.a.fire;
  return {
    tick() {
      for (const k of FOOT_KEYS) {
        const now = input.held(k);
        edge[k] = now && !prev[k];
        prev[k] = now;
      }
      const f = fire();
      edge.fire = f && !prev.fire;
      prev.fire = f;
    },
    fire,
    aim: () => !!input.a.mouseR || (!!input.a.usingPad && input.a.brake > 0.3),
    pressed: (k) => !!edge[k],
    held: (k) => input.held(k),
    axis() {
      const h = input.held;
      const t = input.a && input.a.touch; // touch: the left stick walks, pushed far it runs
      if (t && t.stickActive) return { x: t.stickX, z: t.stickY, run: Math.hypot(t.stickX, t.stickY) > 0.85 };
      return {
        x: (h("KeyD") ? 1 : 0) - (h("KeyA") ? 1 : 0),
        z: (h("KeyW") ? 1 : 0) - (h("KeyS") ? 1 : 0),
        run: h("ShiftLeft") || h("ShiftRight"),
      };
    },
  };
}