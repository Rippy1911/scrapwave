// The touch state: written by the on-screen controls (and window.scrapwake.touch), merged into the shared action
// state by core/input.js. Outputs (steer .. roll, keys, edges) are recomputed by the controller every step.
//
// Button actions: throttle, brake, turbo, fire, rockets, trap, use, jump, summon, climb, descend, pause.
export const ACTIONS = ["throttle", "brake", "turbo", "fire", "rockets", "trap", "use", "jump", "summon", "climb", "descend", "pause"];

export function createTouchState() {
  return {
    on: true,
    stickX: 0, stickY: 0, // left stick, -1..1; y + = up on screen = forward / W
    held: new Set(), // button actions held right now
    pressed: [], // button presses since the last step (edges)
    // Outputs merged into input.a by core/input.js:
    steer: 0, throttle: 0, brake: 0, handbrake: false, turbo: false, fire: false, rockets: false,
    pitch: 0, roll: 0, stickActive: false,
    keys: new Set(), // virtual held key codes for code that reads input.held(): KeyE, KeyZ, Space
    edges: [], // input edge names to raise once: trapDrop, pause
    lookDX: 0, lookDY: 0, // swipe on the empty right side (pixels)
  };
}

export function pressAction(t, name) {
  if (!ACTIONS.includes(name)) return false;
  if (!t.held.has(name)) t.pressed.push(name);
  t.held.add(name);
  return true;
}

export function releaseAction(t, name) {
  t.held.delete(name);
}

export function setStick(t, x, y) {
  const m = Math.hypot(x, y);
  const k = m > 1 ? 1 / m : 1;
  t.stickX = x * k; t.stickY = y * k;
}

export function clearTouch(t) {
  t.held.clear(); t.pressed.length = 0; t.keys.clear(); t.edges.length = 0;
  t.stickX = t.stickY = 0; t.lookDX = t.lookDY = 0;
}