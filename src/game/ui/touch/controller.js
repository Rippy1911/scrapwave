// Touch controller: owns the touch state, turns held buttons and the stick into the shared actions once per
// simulation step (it runs at the top of input.update), per mode: driving, on foot, flying.
// Disabled (desktop): input.a.touch stays null, so keyboard, mouse and gamepad are exactly as before.
import { createTouchState, pressAction, releaseAction, setStick, clearTouch } from "@/game/ui/touch/state";
import { wantTouch } from "@/game/ui/touch/detect";
import { getTouchPrefs, onTouchPrefs } from "@/game/ui/touch/prefs";

const DEAD = 0.12;
// Dead zone, then a soft curve so small thumb moves steer gently and a full push is full lock.
const curve = (v) => {
  const m = Math.abs(v);
  if (m < DEAD) return 0;
  const k = (m - DEAD) / (1 - DEAD);
  return Math.sign(v) * k * (0.5 + 0.5 * k);
};
const DRIFT_STEER = 0.6, DRIFT_SPEED = 8; // brake + hard steer above ~30 km/h = handbrake drift

export function createTouch(game) {
  const t = createTouchState();
  const input = game.input;
  const listeners = new Set();
  let enabled = false;

  const mode = () => (game.onfoot.active() ? "foot" : game.air.active() ? "air" : "drive");

  function prepare() {
    if (!enabled) return;
    const m = mode(), h = t.held;
    const tapped = new Set(t.pressed); // a tap shorter than one step still counts once
    t.pressed.length = 0;
    const on = (n) => h.has(n) || tapped.has(n);
    const sx = curve(t.stickX), sy = curve(t.stickY);
    t.stickActive = sx !== 0 || sy !== 0;
    t.keys.clear();
    t.steer = t.throttle = t.brake = t.pitch = t.roll = 0;
    t.handbrake = t.turbo = t.fire = t.rockets = false;
    if (m === "drive") {
      t.steer = sx; t.pitch = sy; t.roll = sx; // in the air the stick pitches and rolls, like W A S D
      t.throttle = h.has("throttle") ? 1 : 0;
      const drift = h.has("brake") && Math.abs(sx) > DRIFT_STEER && game.player.vel.length() > DRIFT_SPEED;
      t.handbrake = drift;
      t.brake = h.has("brake") && !drift ? 1 : 0;
      t.turbo = h.has("turbo"); t.fire = h.has("fire"); t.rockets = h.has("rockets");
      if (on("use")) t.keys.add("KeyE"); // get out (stopped, in a safe zone)
      if (tapped.has("trap")) t.edges.push("trapDrop");
      if (tapped.has("build")) t.edges.push("build"); // the B key: build view on your plot, the garage in town
    } else if (m === "foot") {
      if (on("use")) t.keys.add("KeyE"); // get in / use the Trader, Garage, Job Board
      if (on("jump")) t.keys.add("Space");
      if (on("summon")) t.keys.add("KeyZ");
    } else if (tapped.has("use")) game.air.exit(false); // flying: climb / descend are read by air/keys.js
    if (tapped.has("pause")) t.edges.push("pause");
    input.a.mouseActive = false; // aim from the screen centre, never a stray emulated mouse position
    if (game.playerAim.mode() !== "assisted") game.playerAim.assist.setMode("assisted"); // always assisted on touch
  }

  const baseUpdate = input.update;
  input.update = () => { prepare(); baseUpdate(); };

  function setEnabled(v) {
    v = !!v;
    if (v === enabled) return enabled;
    enabled = v;
    clearTouch(t);
    input.a.touch = v ? t : null;
    document.documentElement.classList.toggle("sw-touch", v);
    if (!v) game.playerAim.assist.setMode(game.save.aimMode || "assisted"); // back to the saved choice
    for (const fn of listeners) fn(v);
    return v;
  }
  const refresh = () => setEnabled(wantTouch(getTouchPrefs().show));

  // No pinch zoom (iOS ignores user-scalable) and audio starts on the first tap.
  const noGesture = (e) => { if (enabled) e.preventDefault(); };
  const firstTap = () => {
    if (!enabled) return;
    game.audio.init();
    for (const k of ["master", "music", "sfx"]) if (game.save.volume) game.audio.setVolume(k, game.save.volume[k]);
    window.removeEventListener("pointerdown", firstTap);
  };
  document.addEventListener("gesturestart", noGesture, { passive: false });
  window.addEventListener("pointerdown", firstTap);
  const offPrefs = onTouchPrefs(refresh);
  refresh();

  return {
    state: t,
    enabled: () => enabled,
    mode,
    refresh,
    setEnabled,
    press: (name) => pressAction(t, name),
    release: (name) => releaseAction(t, name),
    stick: (x, y) => setStick(t, x, y),
    look(dx, dy) { t.lookDX += dx; t.lookDY += dy; },
    // True where the Build button does something: inside your own lit plot, or at the garage.
    canBuild() {
      const p = game.player, m = game.base.mine();
      return game.inGarage(p) || !!(m && !m.dark && game.base.plots.inside(m, p.pos.x, p.pos.z));
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() {
      offPrefs();
      document.removeEventListener("gesturestart", noGesture);
      window.removeEventListener("pointerdown", firstTap);
      input.update = baseUpdate;
      document.documentElement.classList.remove("sw-touch");
    },
  };
}