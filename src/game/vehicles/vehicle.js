// Vehicle entity: state, part damage, wrecking, and mesh sync with interpolation.
import * as THREE from "three";
import { VEHICLES, WEAPONS, ARMOUR_TIERS, RAM, DAMAGE, FUEL, TANK } from "@/game/data/tuning";
import { isTank } from "@/game/vehicles/tank";
import { CHASSIS, LOADOUTS } from "@/game/data/vehicles";
import { buildVehicleMesh } from "@/game/vehicles/build";
import { initBody, removeBody } from "@/game/vehicles/physics";
import { disposeTag } from "@/game/vehicles/nametag";
import { clampPitch } from "@/game/weapons/aimLimits";
import { clampTankPitch } from "@/game/vehicles/tank";

let nextId = 1;
const qi = new THREE.Quaternion(), lp = new THREE.Vector3(), aimL = new THREE.Vector3();

export function createVehicle(game, chassisId, o = {}) {
  const stats = VEHICLES[chassisId], chassis = CHASSIS[chassisId];
  const loadout = o.loadout || LOADOUTS[chassisId];
  const armour = o.armour || {};
  const armourHp = {};
  let loadMass = 0;
  for (const z in armour) { const t = ARMOUR_TIERS.find((a) => a.id === armour[z]); if (t) { armourHp[z] = t.hp; loadMass += t.mass; } }
  for (const k in loadout) if (WEAPONS[loadout[k]]) loadMass += WEAPONS[loadout[k]].mass;
  if (loadout.ram) loadMass += RAM.mass;
  const mesh = buildVehicleMesh(chassisId, { paint: o.paint, paint2: o.paint2, loadout, armour, armourHp, ram: loadout.ram, plate: o.plate }, game.M, game.T);
  game.scene.add(mesh.root);
  const maxHull = o.hull || stats.hull;
  const v = {
    id: nextId++, team: o.team || "player", name: o.name || stats.name, chassisId, stats, chassis, mesh,
    mass: stats.mass + loadMass, loadMass, ram: !!loadout.ram, nitro: !!o.nitro, welder: !!o.welder,
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3(), angVel: new THREE.Vector3(),
    prevPos: new THREE.Vector3(), prevQuat: new THREE.Quaternion(),
    hull: maxHull, maxHull, turbo: 1, alive: true, scrap: 0, burn: 0, lastHitBy: null, lastCombat: -99,
    fuel: FUEL.tank, fuelMax: FUEL.tank, fuelUse: 1,
    aimPoint: new THREE.Vector3(), wreckTime: 0, skill: o.skill, dmgDirty: 0,
    ctl: { throttle: 0, brake: 0, steer: 0, handbrake: false, turbo: false, pitch: 0, roll: 0, yaw: 0, level: false, fire: false, rockets: false, harpoon: false },
    weapons: mesh.mounts.map((m) => ({ mount: m, id: m.weaponId, def: WEAPONS[m.weaponId], cd: 0, ammo: WEAPONS[m.weaponId].count || 1, reload: 0, salvo: 0, gap: 0, flip: 0 })),
  };
  v.mesh.root.userData.vehicle = v;
  initBody(v);
  v.onImpact = (dmg, point, nrm) => {
    game.particles.sparks(point.x, point.y, point.z, Math.min(20, 4 + dmg / 4), nrm.x, nrm.y, nrm.z);
    game.audio.impact(point, Math.min(1, dmg / 60));
    damageVehicle(game, v, dmg, point, null, { blunt: true });
  };
  return v;
}

export function placeVehicle(v, x, y, z, heading) {
  v.pos.set(x, y, z);
  v.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
  v.vel.set(0, 0, 0); v.angVel.set(0, 0, 0);
  v.prevPos.copy(v.pos); v.prevQuat.copy(v.quat);
}

const ZONE_OF = (l, C) => {
  const h = C.hit.half, c = C.hit.center;
  const rx = (l.x - c[0]) / h[0], ry = (l.y - c[1]) / h[1], rz = (l.z - c[2]) / h[2];
  const ax = Math.abs(rx), ay = Math.abs(ry), az = Math.abs(rz);
  if (ay > ax && ay > az && ry > 0) return "top";
  if (az >= ax) return rz < 0 ? "front" : "rear";
  return rx < 0 ? "left" : "right";
};

export function damageVehicle(game, v, amount, point, attacker, o = {}) {
  if (!v.alive || amount <= 0 || v.god) return; // god: test hook
  if (attacker && game.inSafeZone && game.inSafeZone(v)) return;
  qi.copy(v.quat).invert();
  lp.copy(point).sub(v.pos).applyQuaternion(qi);
  const zone = ZONE_OF(lp, v.chassis);
  let hullDmg = amount;
  const arm = v.mesh.parts.find((p) => p.kind === "armour" && p.zone === zone && !p.detached);
  if (arm) {
    const absorbed = Math.min(arm.hp, amount * 0.7);
    arm.hp -= absorbed; hullDmg -= absorbed;
    if (arm.hp <= 0) detachPart(game, v, arm, attacker);
  }
  // Nearest breakable part takes a share and may come off.
  let best = null, bd = Infinity;
  for (const p of v.mesh.parts) {
    if (p.detached || !p.center || p.kind === "body" || p.kind === "armour") continue;
    const d = Math.max(0, Math.abs(lp.x - p.center.x) - p.half.x) + Math.max(0, Math.abs(lp.y - p.center.y) - p.half.y) + Math.max(0, Math.abs(lp.z - p.center.z) - p.half.z);
    if (d < bd) { bd = d; best = p; }
  }
  if (best && bd < (o.splash ? 1.6 : 0.8)) {
    best.hp -= amount * (best.kind === "wheel" ? 0.8 : 1);
    if (best.hp <= 0) detachPart(game, v, best, attacker);
  }
  const mul = v.chassis.armourMul?.[zone] ?? (v.tankArmourMul && isTank(v) ? v.tankArmourMul[zone] : 1);
  if (o.weapon === "mg" && isTank(v)) hullDmg *= TANK.mgVsTank;
  v.hull -= hullDmg * mul * (o.blunt ? 0.6 : 1);
  if (attacker) { v.lastHitBy = attacker; v.lastCombat = game.time; if (attacker.lastCombat !== undefined) attacker.lastCombat = game.time; }
  if (v === game.player) game.onPlayerHit(amount, point);
  if (attacker && attacker === game.player) game.onHitMarker(v, amount);
  if (!o.blunt && Math.random() < 0.6) scorch(v, lp, amount);
  // the shell takes a dent on heavy knocks (rams, landings, close blasts)
  if (v.mesh.shell && (o.blunt ? amount > 12 : amount > 30)) v.mesh.shell.dent(lp, 0.3 + Math.min(0.45, amount / 140), Math.min(0.16, 0.03 + amount / 500));
  if (v.hull <= 0) wreckVehicle(game, v, attacker);
}

function scorch(v, at, amount = 20) {
  if (v.mesh.shell && at) v.mesh.shell.scorch(at, 0.25 + Math.min(0.4, amount / 120));
  const ctx = v.mesh.dmgCanvas.getContext("2d");
  const x = Math.random() * 256, y = Math.random() * 256, r = 3 + Math.random() * 10;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
  g.addColorStop(0, "rgba(10,8,6,0.95)"); g.addColorStop(0.35, "rgba(40,28,20,0.6)"); g.addColorStop(1, "rgba(40,28,20,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, 7); ctx.fill();
  ctx.fillStyle = "#c9c2b5"; ctx.beginPath(); ctx.arc(x, y, r * 0.25, 0, 7); ctx.fill();
  v.dmgDirty = 1;
}

export function detachPart(game, v, part, attacker) {
  if (part.detached) return;
  part.detached = true;
  const dir = new THREE.Vector3().subVectors(part.obj.getWorldPosition(new THREE.Vector3()), v.pos).setY(0).normalize();
  game.fx.detach(v, part, dir);
  game.rec.event("part", v.pos);
  game.lastPartOff = { pos: v.pos.clone(), time: game.time, v };
  game.particles.sparks(v.pos.x + dir.x, v.pos.y + 0.5, v.pos.z + dir.z, 10, dir.x, 0.5, dir.z);
  if (part.kind === "weapon") { const w = v.weapons.find((x) => x.mount.part === part); if (w) w.disabled = true; }
  if (part.kind === "ram") v.ram = false;
  if (attacker && attacker === game.player) game.onPartOff(v, part);
}

export function wreckVehicle(game, v, attacker) {
  if (!v.alive) return;
  v.alive = false; v.hull = 0; v.burn = DAMAGE.wreckLife; v.wreckTime = DAMAGE.wreckLife;
  v.mesh.paintMat.color.set("#3a302a");
  v.mesh.paintMat.map = null; v.mesh.paintMat.needsUpdate = true;
  if (v.mesh.shell) v.mesh.shell.U.uBurnt.value = 0.92;
  for (const f of v.mesh.flames) f.visible = false;
  const loose = v.mesh.parts.filter((p) => !p.detached && p.kind !== "body" && p.center);
  for (let i = 0; i < Math.min(4, loose.length); i++) detachPart(game, v, loose[Math.floor(Math.random() * loose.length)], null);
  v.vel.y += 6; v.angVel.x += (Math.random() - 0.5) * 3; v.angVel.z += (Math.random() - 0.5) * 3;
  game.combat.explode(v.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 8, 90, attacker, 1.3, v);
  game.onWreck(v, attacker);
}

// Interpolated mesh sync + turret aim + wheel visuals. Called per render frame.
export function syncVehicle(v, alpha, dt) {
  const m = v.mesh, C = v.chassis;
  m.root.position.lerpVectors(v.prevPos, v.pos, alpha);
  m.root.quaternion.slerpQuaternions(v.prevQuat, v.quat, alpha);
  for (let i = 0; i < m.wheels.length; i++) {
    const w = m.wheels[i], st = v.wheelState[i], wd = w.def;
    if (w.part.detached) continue;
    const target = wd.pos[1] + (st.contact ? st.comp - C.susLen * 0.5 : -C.susLen * 0.3);
    w.pivot.position.y += (target - w.pivot.position.y) * Math.min(1, dt * 25);
    if (wd.steer) w.pivot.rotation.y = -v.steer;
    w.spin.rotation.x -= st.spin * dt;
  }
  const on = v.turboActive;
  for (const f of m.flames) { f.visible = on; if (on) f.scale.set(1, 0.8 + Math.random() * 0.5, 1); }
  if (v.dmgDirty) { m.dmgTex.needsUpdate = true; v.dmgDirty = 0; }
  if (!v.alive) return;
  m.root.updateMatrixWorld();
  for (const w of v.weapons) {
    if (w.disabled) continue;
    const mod = w.mount.model;
    aimL.copy(v.aimPoint);
    mod.root.worldToLocal(aimL);
    aimL.y -= mod.pitch.position.y;
    const yaw = Math.atan2(-aimL.x, -aimL.z);
    const pitchRaw = Math.atan2(aimL.y, Math.hypot(aimL.x, aimL.z));
    const onTurret = w.mount.hp.turret || w.mount.hp.coax;
    const pitch = onTurret ? clampTankPitch(pitchRaw) : clampPitch(pitchRaw);
    const tr = onTurret && v.turretTraverse ? v.turretTraverse : 14;
    mod.yaw.rotation.y += angDiff(mod.yaw.rotation.y, yaw) * Math.min(1, dt * tr);
    mod.pitch.rotation.x += (pitch - mod.pitch.rotation.x) * Math.min(1, dt * tr);
  }
}
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function removeVehicle(game, v) {
  removeBody(v);
  v.mesh.root.removeFromParent();
  disposeTag(v);
  v.mesh.paintMat.dispose(); v.mesh.dmgTex.dispose();
  if (v.mesh.shell) v.mesh.shell.material.dispose();
}