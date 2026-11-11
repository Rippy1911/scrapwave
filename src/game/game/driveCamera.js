// Per-frame menu keys and camera ownership: build view, on foot, intro swoop, demo director, autopilot cinecam,
// else the chase cam. Also syncs every car's interpolated pose for rendering.
import { syncVehicle } from "@/game/vehicles/vehicle";

export function driveCamera(game, p, real, alpha, realTime) {
  const { emit, input } = game;
  if (input.edge("pause")) { if (game.buildView.active) game.buildView.close(); else emit({ type: "pause" }); }
  if (input.edge("chat")) emit({ type: "chatOpen" });
  if (input.edge("map")) emit({ type: "map" }); // the map screen (round 11: with the Reputation panel)
  if (input.edge("photo") && !game.buildView.active && !game.demo.running && !game.replay.active) emit({ type: "photo" }); // O: photo mode
  // T transforms a machine with a Transform Core (game.mech reads the key); otherwise it opens the emote wheel.
  if (!game.mech.ownsT() && input.edge("emote") && game.player.alive) emit({ type: "emoteOpen" });
  if (input.edge("build") && !game.autopilot && game.player.alive && !game.demo.running) {
    if (game.buildView.active) game.buildView.close();
    else if (game.inGarage(game.player)) emit({ type: "garage" });
    else if (!game.buildView.open() && game.base.mine() && !game.base.mine().dark) emit({ type: "minor", text: "DRIVE INTO YOUR PLOT TO BUILD" });
  }
  const [dx, dy] = input.takeAim();
  const foot = game.onfoot.active(), orbit = foot ? game.onfoot.orbit : game.cam.orbit;
  if (!game.autopilot && input.a.locked && !game.loop.paused) orbit(dx, dy);
  const t = input.a.touch; // touch: swipe the empty right side to look around
  if (t && (t.lookDX || t.lookDY)) { if (!game.autopilot && !game.loop.paused) orbit(t.lookDX, t.lookDY); t.lookDX = t.lookDY = 0; }
  if (!game.autopilot && (input.a.stickAimX || input.a.stickAimY)) orbit(input.a.stickAimX * 14, input.a.stickAimY * 9);
  // Free mouse (no pointer lock, no touch): the upper part of the screen aims above the horizon.
  if (!foot && !t && !game.autopilot && !input.a.locked && input.a.mouseActive && !input.a.usingPad) game.cam.aimFromScreen(input.a.mouseY, real);
  for (const v of game.vehicles) syncVehicle(v, alpha, real);
  game.cam.update(p, real, false, p.vel.length() * 3.6, p.turboActive);
  let owned = game.photo.frame(real) || game.buildView.frame(real);
  if (owned) { /* top-down build camera */ } else if (foot) { game.onfoot.view(real); owned = true; }
  else if (game.introT > 0 && game.cine.swooping()) { game.cine.applySwoop(p, real); owned = true; }
  else if (game.demo.running && !game.loop.paused) owned = game.demo.update(real);
  else if (game.autopilot && !game.loop.paused) owned = game.cine.update(game, real);
  if (!owned) owned = game.air.camera(real, realTime); // flying: the aircraft chase camera
  if (!owned) game.cam.apply(game.world.groundAt, realTime);
}