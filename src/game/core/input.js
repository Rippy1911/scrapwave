// One input layer: keyboard (event.code), mouse and Gamepad API mapped to one action state.
import { padMech, PAD_CHORD_BUTTONS } from "@/game/core/padMech";

const PREVENT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"]);
const EDGE_KEYS = {
  KeyQ: "cycle", KeyB: "build", KeyL: "job", KeyM: "map", KeyC: "camera", Escape: "pause", KeyP: "pause",
  KeyF: "rockets", KeyE: "harpoon", KeyV: "smoke", KeyN: "horn",
  KeyG: "trapDrop", KeyH: "trapCycle", KeyU: "trapShop", Tab: "target", // round 8: trap slot, trap shop, next target
  Enter: "chat", NumpadEnter: "chat", KeyT: "emote",
  KeyO: "photo", // round 13: photo mode
};
const SCOREBOARD_HOLD = 300; // ms: a Tab tap cycles the target, holding Tab shows the scoreboard
const typing = (e) => e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");

export function createInput() {
  const keys = new Set();
  const edges = {};
  const a = {
    throttle: 0, brake: 0, steer: 0, pitch: 0, roll: 0, handbrake: false, turbo: false,
    fire: false, rocketsHeld: false, harpoonHeld: false, reset: false, scoreboard: false,
    aimDX: 0, aimDY: 0, mouseX: 0.5, mouseY: 0.45, mouseActive: false, stickAimX: 0, stickAimY: 0,
    usingPad: false, locked: false, touch: null,
  };
  let mouseL = false, mouseR = false, tabAt = 0;
  let padPrev = {};
  let padHeld = new Set(), lbChord = false; // machine chords on the pad (core/padMech.js); a.mechPad is set by game.mech
  let anyKeyCb = null;

  const kd = (e) => {
    if (typing(e)) return; // chat box / name field
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "Tab") tabAt = performance.now();
    a.usingPad = false;
    const ed = EDGE_KEYS[e.code];
    if (ed) edges[ed] = true;
    if (anyKeyCb) anyKeyCb(e);
  };
  const ku = (e) => { keys.delete(e.code); };
  const md = (e) => {
    if (e.button === 0) mouseL = true;
    if (e.button === 2) mouseR = true;
    if (anyKeyCb) anyKeyCb(e);
  };
  const mu = (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; };
  const mm = (e) => {
    a.aimDX += e.movementX || 0; a.aimDY += e.movementY || 0;
    a.mouseX = e.clientX / window.innerWidth; a.mouseY = e.clientY / window.innerHeight;
    a.mouseActive = !a.touch; // touch: aim stays on the screen centre
  };
  const cm = (e) => e.preventDefault();
  const blur = () => { keys.clear(); mouseL = mouseR = false; };
  const plc = () => { a.locked = !!document.pointerLockElement; };

  window.addEventListener("keydown", kd, { passive: false });
  window.addEventListener("keyup", ku);
  window.addEventListener("mousedown", md);
  window.addEventListener("mouseup", mu);
  window.addEventListener("mousemove", mm);
  window.addEventListener("contextmenu", cm);
  window.addEventListener("blur", blur);
  document.addEventListener("pointerlockchange", plc);

  const k = (...codes) => codes.some((c) => keys.has(c));
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);

  function update() {
    let throttle = k("KeyW", "ArrowUp") ? 1 : 0;
    let brake = k("KeyS", "ArrowDown") ? 1 : 0;
    let steer = (k("KeyD", "ArrowRight") ? 1 : 0) - (k("KeyA", "ArrowLeft") ? 1 : 0);
    let handbrake = k("Space");
    let turbo = k("ShiftLeft", "ShiftRight") || mouseR;
    let fire = mouseL || k("KeyJ"); // J fires the guns too
    a.rocketsHeld = k("KeyF"); a.harpoonHeld = k("KeyE");
    a.heavyHeld = k("KeyK"); // K: rockets, or the harpoon on a car without rockets
    a.mouseR = mouseR; // on foot the right button aims (onfoot/keys.js); driving it is turbo, as before
    a.reset = k("KeyR"); a.scoreboard = k("Tab") && performance.now() - tabAt > SCOREBOARD_HOLD;
    a.stickAimX = 0; a.stickAimY = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((x) => x && x.connected);
    if (p) {
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const v = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
      const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0);
      const rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
      const active = Math.abs(lx) + Math.abs(rx) + Math.abs(ry) + v(6) + v(7) > 0.05 || p.buttons.some((x) => x.pressed);
      if (active) a.usingPad = true;
      if (a.usingPad) {
        // Driving a machine with joints, LB held turns the face buttons and D-pad into machine chords.
        const chord = !!a.mechPad && b(4), nb = chord ? (i) => !PAD_CHORD_BUTTONS.has(i) && b(i) : b;
        const pm = chord ? padMech(b, padPrev) : null;
        padHeld = pm ? pm.held : new Set();
        if (pm) { for (const e of pm.edges) edges[e] = true; if (pm.held.size || pm.edges.length) lbChord = true; }
        if (Math.abs(lx) > Math.abs(steer)) steer = lx;
        throttle = Math.max(throttle, v(7)); brake = Math.max(brake, v(6));
        handbrake = handbrake || nb(0); turbo = turbo || b(5); fire = fire || nb(2);
        a.rocketsHeld = a.rocketsHeld || nb(12); a.harpoonHeld = a.harpoonHeld || nb(1);
        a.stickAimX = rx; a.stickAimY = ry;
        a.pitchPad = ly;
        const edge = (i, name) => { if (nb(i) && !padPrev[i]) edges[name] = true; };
        edge(3, "cycle"); edge(9, "pause"); edge(8, "map"); edge(12, "rockets"); edge(13, "trapDrop"); edge(14, "trapCycle"); edge(15, "target");
        edge(1, "harpoon"); edge(10, "job"); edge(11, "build");
        if (!a.mechPad) edge(4, "camera");
        else if (!b(4) && padPrev[4]) { if (!lbChord) edges.camera = true; lbChord = false; } // LB alone: camera on release
        if (p.buttons.some((x, i) => x.pressed && !padPrev[i]) && anyKeyCb) anyKeyCb({ code: "Gamepad" });
        padPrev = p.buttons.map((x) => x.pressed);
      }
    }
    const t = a.touch; // touch controls (src/game/ui/touch): merged into the same actions the keys produce
    if (t) {
      if (Math.abs(t.steer) > Math.abs(steer)) steer = t.steer;
      throttle = Math.max(throttle, t.throttle); brake = Math.max(brake, t.brake);
      handbrake = handbrake || t.handbrake; turbo = turbo || t.turbo; fire = fire || t.fire;
      a.heavyHeld = a.heavyHeld || t.rockets; // rockets, or the harpoon on a car without rockets (like K)
      for (const e of t.edges) edges[e] = true; // trapDrop, pause
      t.edges.length = 0;
    }
    a.throttle = throttle; a.brake = brake; a.steer = Math.max(-1, Math.min(1, steer));
    a.handbrake = handbrake; a.turbo = turbo; a.fire = fire;
    // Air control is W, A, S, D only (never the arrow keys); a pad or the touch stick still uses its stick.
    a.pitch = (k("KeyW") ? 1 : 0) - (k("KeyS") ? 1 : 0);
    if (a.usingPad && a.pitchPad) a.pitch = -a.pitchPad;
    a.roll = (k("KeyD") ? 1 : 0) - (k("KeyA") ? 1 : 0);
    if (a.usingPad) a.roll = a.steer;
    if (t && t.stickActive) { a.pitch = t.pitch; a.roll = t.roll; }
  }

  return {
    a,
    update,
    edge(name) { const v = !!edges[name]; edges[name] = false; return v; },
    peekEdge(name) { return !!edges[name]; },
    clearEdges() { for (const e in edges) edges[e] = false; },
    takeAim() { const d = [a.aimDX, a.aimDY]; a.aimDX = 0; a.aimDY = 0; return d; },
    onAnyKey(cb) { anyKeyCb = cb; },
    held: (code) => keys.has(code) || padHeld.has(code) || !!(a.touch && a.touch.keys.has(code)), // pad chords: Digit1-6; touch: virtual E / Z / Space
    dispose() {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu);
      window.removeEventListener("mousemove", mm); window.removeEventListener("contextmenu", cm);
      window.removeEventListener("blur", blur); document.removeEventListener("pointerlockchange", plc);
    },
  };
}