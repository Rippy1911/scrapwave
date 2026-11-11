// Winged cars (round 13): fitting wings onto a vehicle and the flight forces physics.js adds each step.
// A car without wings has no v.wings and never comes here, so it flies exactly as before.
import * as THREE from "three";
import { sanitizeWings, wingAero, liftAt, dragAt, packWings, unpackWings, wingSpec } from "@/game/workshop/wings";
import { buildWing } from "@/game/vehicles/wingMesh";

export const WING_TURBO_DRAIN = 0.45; // flying burns the turbo tank slower than a wingless air boost (about 9 s of flight)
const MASS_REF = 1300; // kg: the car the lift numbers in wings.js are tuned for
const AOA = 64; // how hard the wings pull the flight path onto the nose (per lift coefficient)
const AOA_MAX = 4; // 1/s
const GROUND_LIFT_MAX = 1.15; // take-off run: lift on the wheels, turbo held
const WEATHER = 2.2, PITCH_STAB = 0.9, BANK_TURN = 1.4, ROLL_LOST = 3.2; // rad/s2 scales
const SIDE_GRIP = 1.1; // 1/s: how fast sideslip dies in the air
const tmp = new THREE.Vector3();

// Mount a wing list on a freshly created vehicle. list: [{ id, tier, side, off? }] or the packed text form.
export function fitWings(game, v, list) {
  const wings = sanitizeWings(typeof list === "string" ? unpackWings(list) : list);
  if (!wings.length || v.wings) return null;
  v.wings = [];
  for (const w of wings) {
    const b = buildWing(w, v.chassis, game.M, v.mesh.paintMat);
    v.mesh.body.add(b.obj);
    const part = { id: b.spec.fin ? "fin" : "wing_" + w.side, kind: "wing", zone: w.side === "roof" ? "top" : w.side, obj: b.obj, hp: b.spec.hp, maxHp: b.spec.hp, detached: false, center: b.center, half: b.half };
    v.mesh.parts.push(part);
    v.wings.push({ id: w.id, tier: w.tier, side: w.side, part });
  }
  v.wingGround = (x, z) => game.world.terrain.heightAt(x, z);
  v._wingLost = -1;
  if (typeof list === "string") applyWingState(v, list);
  return currentAero(v);
}

const plain = (v) => v.wings.map((w) => ({ id: w.id, tier: w.tier, side: w.side, off: w.part.detached }));

// Totals for the wings still on the car (recomputed only when one comes off).
export function currentAero(v) {
  if (!v.wings) return null;
  let lost = 0;
  for (const w of v.wings) if (w.part.detached) lost++;
  if (lost !== v._wingLost) { v._wingLost = lost; v.wingAero = wingAero(plain(v), v.mass / MASS_REF); }
  return v.wingAero;
}

// Network form of this car's wings ("swept2l,swept2r!"), and applying it to a remote copy (hides ripped wings).
export const wingsPacked = (v) => (v.wings ? packWings(plain(v)) : "");
export function applyWingState(v, text) {
  if (!v.wings || !text) return;
  const want = unpackWings(text);
  for (const w of v.wings) {
    const m = want.find((x) => x.id === w.id && x.side === w.side);
    if (m && m.off && !w.part.detached) { w.part.detached = true; w.part.obj.visible = false; }
  }
}

// Called from physics.js after its own forces are summed and before they are applied.
// force: the accumulated force (N). fwd/up/right: body axes in world space. speed: velocity along the nose (m/s).
export function wingStep(v, force, fwd, up, right, speed, airborne, turboOn, dt, gravity) {
  const a = currentAero(v);
  v.wingLift = 0; v.flying = false;
  if (!a || !(a.count + a.fins) || !v.alive) return;
  if (!airborne && !(turboOn && a.has)) return; // on the wheels without turbo: only the lower top speed applies
  const alt = v.pos.y - v.wingGround(v.pos.x, v.pos.z), sp = v.vel.length();
  let lf = liftAt(a, Math.max(0, speed), alt);
  if (!airborne) lf = Math.min(lf, GROUND_LIFT_MAX);
  v.wingLift = lf; v.wingAlt = alt; v.flying = airborne && lf > 0.5;
  force.addScaledVector(up, lf * gravity * v.mass);
  if (!airborne) return;

  // The wings resist moving through the air flat-on: the flight path swings onto the nose (fades out in a stall).
  const stallK = a.has ? Math.max(0, Math.min(1, (speed / a.stall - 0.7) / 0.3)) : 0;
  const vn = v.vel.dot(up);
  const grip = Math.min(AOA_MAX, AOA * a.liftK * Math.abs(speed)) * stallK;
  force.addScaledVector(up, -vn * grip * v.mass);
  // Drag along the flight path, and the fin (or the wings' own side area) killing sideslip.
  if (sp > 0.5) force.addScaledVector(v.vel, (-dragAt(a, sp, lf, gravity) * v.mass) / sp);
  const slip = v.vel.dot(right), stab = 0.5 + a.stab;
  force.addScaledVector(right, -slip * SIDE_GRIP * stab * v.mass);
  // Ceiling: no climbing past it.
  if (alt > a.ceiling && v.vel.y > 0) force.y -= (v.vel.y * 1.5 + gravity * 0.5) * v.mass;

  // Turning moments: the nose follows the flight path, a banked car turns toward its low wing,
  // and a car that lost a wing rolls toward the missing side.
  const k = Math.min(1, sp / 25);
  tmp.set(0, 0, 0);
  if (sp > 3) {
    tmp.addScaledVector(up, (-slip / sp) * WEATHER * stab * k);
    tmp.addScaledVector(right, (vn / sp) * PITCH_STAB * k * (1 - stallK * 0.6));
  }
  tmp.y += right.y * BANK_TURN * lf;
  tmp.addScaledVector(fwd, a.rollBias * ROLL_LOST * lf);
  v.angVel.addScaledVector(tmp, dt);
  v.rb.setAngvel(v.angVel, true);
  v._s[10] = v.angVel.x; v._s[11] = v.angVel.y; v._s[12] = v.angVel.z;
}

// For the HUD and the test hooks.
export function wingState(v) {
  const a = currentAero(v);
  if (!a) return null;
  return {
    wings: a.count, fins: a.fins, lost: a.lost, lift: +(v.wingLift || 0).toFixed(2), flying: !!v.flying,
    stallKmh: a.has ? Math.round(a.stall * 3.6) : null, alt: Math.round(v.wingAlt || 0), rollBias: +a.rollBias.toFixed(2),
    names: v.wings.map((w) => wingSpec(w.id, w.tier).name),
  };
}