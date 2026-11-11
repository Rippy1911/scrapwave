// Flight keys, read here instead of the shared input layer: W/S, A/D, Q/E, Space and Shift while flying,
// plus X (get out). Attached on boarding, removed on exit. Arrow keys never fly.
const CODES = new Set(["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "Space", "ShiftLeft", "ShiftRight", "KeyX"]);
const typing = (e) => e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");

export function createFlightKeys() {
  const held = new Set();
  let exitEdge = false, on = false;
  const down = (e) => {
    if (!CODES.has(e.code) || typing(e)) return;
    if (e.code === "KeyX" && !e.repeat) exitEdge = true;
    held.add(e.code);
  };
  const up = (e) => held.delete(e.code);
  const blur = () => held.clear();
  const k = (c) => (held.has(c) ? 1 : 0);
  return {
    attach() {
      if (on) return;
      on = true;
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", blur);
    },
    detach() {
      on = false; held.clear(); exitEdge = false;
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    },
    // Gamepad: left stick and triggers through the shared action state (a), when it is in use.
    read(a, out) {
      const pad = a && a.usingPad;
      out.fwd = k("KeyW") - k("KeyS") || (pad ? a.throttle - a.brake : 0);
      out.right = k("KeyD") - k("KeyA") || (pad ? a.steer : 0);
      out.turn = k("KeyE") - k("KeyQ");
      out.up = !!k("Space") || (pad && a.handbrake);
      out.down = !!(k("ShiftLeft") || k("ShiftRight")) || (pad && a.turbo);
      const t = a && a.touch; // touch: the stick pitches and rolls (and yaws a little), two buttons climb / descend
      if (t) {
        if (t.stickActive) { out.fwd = out.fwd || t.stickY; out.right = out.right || t.stickX; out.turn = out.turn || t.stickX * 0.5; }
        out.up = out.up || t.held.has("climb");
        out.down = out.down || t.held.has("descend");
      }
      return out;
    },
    exit() { const e = exitEdge; exitEdge = false; return e; },
  };
}