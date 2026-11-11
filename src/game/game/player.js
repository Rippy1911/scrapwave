// Player input → vehicle controls, camera-ray aiming with light aim assist, utility actions.
import * as THREE from "three";
import { PHYSICS } from "@/game/data/tuning";
import { startRighting } from "@/game/vehicles/physics";
import { crossY } from "@/game/weapons/aimLimits";
import { bindWeapons, groupOf } from "@/game/weapons/binds";

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(0, 0.12), to = new THREE.Vector3();

export function controlPlayer(game, v, dt) {
  const a = game.input.a, c = v.ctl;
  const blocked = game.uiOpen;
  // Menus open: hold the car on the handbrake (brake at rest would reverse).
  c.throttle = blocked ? 0 : a.throttle; c.brake = blocked ? 0 : a.brake; c.steer = blocked ? 0 : a.steer;
  c.handbrake = blocked || a.handbrake; c.turbo = !blocked && a.turbo; c.pitch = blocked ? 0 : a.pitch;
  // Air control: W/S pitch and A/D roll (never the arrows), Q/E yaw, Space levels, turbo thrusts (physics applies them
  // only with no wheel down).
  const air = v.contacts === 0 && v.airTime > 0.1;
  const held = game.input.held;
  c.roll = blocked ? 0 : a.roll;
  c.yaw = blocked || !air ? 0 : (held("KeyE") ? 1 : 0) - (held("KeyQ") ? 1 : 0);
  c.level = !blocked && a.handbrake;
  const safe = game.inSafeZone(v);
  c.fire = !blocked && a.fire && !safe;
  bindWeapons(game.save, v); // round 14: the Loadout screen picks each mount's trigger
  const rocketsFitted = v.weapons.some((w) => groupOf(w) === "heavy" && !w.disabled); // anything on the heavy trigger (F / K)
  c.rockets = !blocked && (a.rocketsHeld || (a.heavyHeld && rocketsFitted)) && !safe;
  c.harpoon = !blocked && (a.harpoonHeld || (a.heavyHeld && !rocketsFitted)) && !safe && !(air && held("KeyE"));
  // R: right the car now (smooth 0.6 s lift-and-turn), then a short cooldown.
  v.resetHeld = a.reset ? (v.resetHeld || 0) + dt : 0;
  v.resetCd = Math.max(0, (v.resetCd || 0) - dt);
  c.reset = !blocked && a.reset; // a fallen bike stands up at once on R (workshop/bike.js)
  // Bikes: a wheelie only when asked, Space held on full throttle (the handbrake is let go for it).
  c.wheelie = !blocked && !!v.stats.bike && v.contacts >= 1 && a.handbrake && a.throttle > 0.7;
  if (c.wheelie) c.handbrake = false;
  if (a.reset && !(v.thrown > 0) && v.resetHeld <= dt + PHYSICS.resetHold + 1e-6 && v.resetHeld > PHYSICS.resetHold && v.resetCd <= 0 && v.alive && startRighting(v)) v.resetCd = PHYSICS.resetCooldown;
  // Mines moved into the trap slot (G drops, H cycles): see src/game/traps/.
  if (game.input.edge("smoke") && v.smokeModule && (v.smokeCd || 0) <= 0) { v.smoke = 6; v.smokeCd = 25; game.callout("SMOKE!", null, "#cfc6b8"); }
  v.smokeCd = Math.max(0, (v.smokeCd || 0) - dt);
  if (v.smoke > 0) { v.smoke -= dt; for (let i = 0; i < 3; i++) game.particles.smoke(v.pos.x, v.pos.y + 0.5, v.pos.z, false, 2.4); }
  if (game.input.edge("horn")) game.audio.horn();
  if (game.input.edge("camera")) game.cam.mode = (game.cam.mode + 1) % 2;
}

// Aim from the camera through the crosshair; snap toward an enemy inside a small cone.
export function updateAim(game, v) {
  // Without pointer lock the aim follows the mouse position on screen; with it, the fixed crosshair.
  const a = game.input.a;
  if (!a.locked && a.mouseActive && !a.usingPad) ndc.set(a.mouseX * 2 - 1, -(a.mouseY * 2 - 1));
  else ndc.set(0, crossY(game.cam)); // the crosshair climbs when the aim goes above the horizon
  ray.setFromCamera(ndc, game.camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let best = null, bestDot = Math.cos(0.07);
  for (const t of game.vehicles) {
    if (t === v || !t.alive || t.team === "player" || game.inSafeZone(t)) continue;
    to.subVectors(t.pos, o);
    const dist = to.length();
    if (dist > 220) continue;
    const dot = to.divideScalar(dist).dot(d);
    if (dot > bestDot) { bestDot = dot; best = t; }
  }
  v.lockTarget = best;
  if (best) { v.aimPoint.copy(best.pos); v.aimPoint.y += 0.4; return best; }
  const start = o.clone().addScaledVector(d, v.mesh.root.position.distanceTo(o) + 2);
  const r = game.combat.ray(start, d, 260, v);
  v.aimPoint.copy(r.point);
  return null;
}