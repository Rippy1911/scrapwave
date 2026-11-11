// Raids: Rattler waves on every lit base (host), Drifters raiding bases they can beat, the siphon hold
// (15 m of the rig for 8 s, a red ring everyone sees), siphoned scrap carried off and dropped as crates on a wreck.
import * as THREE from "three";
import { BASE, CYCLE } from "@/game/data/tuning";
import { net } from "@/game/net/net";
import { driveTo, aimAndFire, holdFire, fightPoint, lineOfSight } from "@/game/ai/steer";
import { surfaceY, clearAt } from "@/game/world/spawn";
import { spawnBulwarkBoss } from "@/game/ai/bulwarkBoss";

const g = new THREE.Vector3(), aim = new THREE.Vector3();
const RANGE = BASE.siphonRange, HOLD = BASE.siphonTime;

export function createRaids(game) {
  const base = game.base, { plots, modules } = base;
  const holds = {};
  let drifterT = 60;
  const scale = () => game.cycle.length / CYCLE.length;
  const send = (kind, data) => net.impl().sendEvent(kind, data);

  function roadPoseNear(x, z, min, max) {
    const roads = game.world.roads.roads;
    for (let i = 0; i < 120; i++) {
      const r = roads[Math.floor(Math.random() * roads.length)], s = r.samples[Math.floor(Math.random() * r.samples.length)];
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < min || d > max || s.deck || s.bridge || game.inTown(s.x, s.z) || !clearAt(game.world, s.x, s.z, 5, game.vehicles)) continue;
      return { x: s.x, y: surfaceY(game.world, s.x, s.z), z: s.z, heading: Math.atan2(-(x - s.x), -(z - s.z)) + Math.PI };
    }
    const a = Math.random() * Math.PI * 2, rx = x + Math.cos(a) * min, rz = z + Math.sin(a) * min;
    return { x: rx, y: surfaceY(game.world, rx, rz), z: rz, heading: 0 };
  }

  function wave(plot) {
    const k = Math.min(1, game.cycle.t / game.cycle.length);
    const n = Math.min(6, 3 + Math.floor(k * 3.5) + ((plot.waves || 0) > 2 ? 1 : 0));
    plot.waves = (plot.waves || 0) + 1;
    const pose = roadPoseNear(plot.x, plot.z, 180, 300);
    for (let i = 0; i < n; i++) {
      const v = game.ai.makeRattler({ ...pose, x: pose.x + (i % 3) * 7 - 7, z: pose.z + Math.floor(i / 3) * 8, y: surfaceY(game.world, pose.x + (i % 3) * 7 - 7, pose.z + Math.floor(i / 3) * 8) }, null, i === 0 ? "pickup" : null);
      v.brain.raid = plot.id; v.brain.raidState = "approach"; v.brain.home = { x: pose.x, z: pose.z };
    }
    if (plot.waves % 3 === 0) {
      const bp = roadPoseNear(plot.x, plot.z, 220, 320);
      spawnBulwarkBoss(game, bp, { team: "rattler", tag: "RAID" }).brain.raid = plot.id;
    }
    base.alertMine && plot.owner && plot.owner.id === game.selfId() && base.alertMine(`Rattler raid inbound: ${n} cars heading for ${plot.name}!`, pose);
    if (plot.owner && plot.owner.id !== game.selfId()) game.emit({ type: "minor", text: `RATTLERS RAIDING ${plot.name.toUpperCase()}` });
  }

  // Waves: about every 6 minutes per lit base (scaled with short cycles), the first a few minutes after the claim.
  function schedule(dt) {
    for (const p of plots.list) {
      if (!p.owner || p.dark || !modules.rigOf(p.id)) { p.nextRaid = null; continue; }
      if (p.nextRaid == null) p.nextRaid = game.time + (150 + Math.random() * 60) * scale();
      if (game.time >= p.nextRaid && game.cycleSys && game.cycleSys.phase() === "run") { p.nextRaid = game.time + (330 + Math.random() * 60) * scale(); wave(p); }
    }
    drifterT -= dt;
    if (drifterT > 0) return;
    drifterT = 80 + Math.random() * 40;
    const rich = plots.list.filter((p) => p.owner && !p.dark && p.stash > 120 && modules.forPlot(p.id).filter((e) => e.kind.endsWith("turret")).length <= 1);
    if (!rich.length) return;
    const plot = rich[Math.floor(Math.random() * rich.length)];
    const raider = game.vehicles.find((v) => v.team === "drifter" && !v.remote && v.alive && v.brain && !v.brain.raid && v.hull > v.maxHull * 0.7 && v.netId !== plot.owner.id && v.pos.distanceTo(base.rigPos(plot)) < 500);
    if (raider) { raider.brain.raid = plot.id; raider.brain.raidState = "approach"; raider.brain.home = { x: raider.pos.x, z: raider.pos.z }; }
  }

  // Host-side raider brain. Returns false when the raid is over (the normal brain takes back over).
  function drive(v, dt) {
    const b = v.brain, plot = plots.byId[b.raid];
    if (!plot || !plot.owner || plot.dark || (b.raidState === "escape" && (b.escapeT += dt) > 60)) { b.raid = null; return false; }
    const rig = modules.rigOf(plot.id);
    if (!rig) { b.raidState = "escape"; b.escapeT = b.escapeT || 0; }
    const owner = base.ownerVehicle(plot);
    const dRig = rig ? Math.hypot(v.pos.x - rig.wx, v.pos.z - rig.wz) : 999;
    if (b.raidState === "escape") {
      g.set(b.home.x, v.pos.y, b.home.z);
      if (Math.hypot(v.pos.x - b.home.x, v.pos.z - b.home.z) < 25) g.set(v.pos.x * 2 - plot.x, v.pos.y, v.pos.z * 2 - plot.z);
      driveTo(v, g, dt, { turbo: true });
      if (owner && owner.alive && owner.pos.distanceTo(v.pos) < 70) aimAndFire(game, v, owner, owner.pos.distanceTo(v.pos), true); else holdFire(v, g);
      return true;
    }
    if (owner && owner.alive && !game.inSafeZone(owner) && owner.pos.distanceTo(v.pos) < 55 && dRig > 12) {
      const d = owner.pos.distanceTo(v.pos);
      driveTo(v, fightPoint(v, owner, d, g), dt);
      aimAndFire(game, v, owner, d, lineOfSight(game, v, owner, d));
      return true;
    }
    // Breach: shoot whatever module stands between us and the rig.
    let wall = null;
    if (dRig < 80) {
      g.set(rig.wx - v.pos.x, 0, rig.wz - v.pos.z).normalize();
      const h = game.world.colliders.raycast(v.pos.x, v.pos.y + 0.8, v.pos.z, g.x, 0, g.z, dRig - 3.2);
      if (h && h.box.mod && h.box.mod.plot === plot.id && h.box.mod.kind !== "rig") wall = h.box.mod;
      else if (h && h.box.piece && h.box.piece.group === `plot:${plot.id}` && h.box.piece.alive) { const pc = h.box.piece; wall = { wx: pc.wx, wy: pc.y0, wz: pc.wz, piece: pc }; }
    }
    if (wall && wall.piece) return breachPiece(v, b, wall, dt); // built walls and gates: rockets and rams
    b.raidState = wall ? "breach" : dRig < 60 ? "siphon" : "approach";
    if (wall) {
      const d = Math.hypot(wall.wx - v.pos.x, wall.wz - v.pos.z);
      g.set(wall.wx, v.pos.y, wall.wz);
      if (d < 22) { Object.assign(v.ctl, { throttle: 0, brake: 1, steer: 0, handbrake: false, turbo: false }); } else driveTo(v, g, dt, { maxSpeed: 14 });
      aim.set(wall.wx, wall.wy + 1.2, wall.wz);
      v.aimPoint.copy(aim); v.lockTarget = null;
      v.ctl.fire = d < 90; v.ctl.rockets = d < 120 && d > 15 && Math.random() < 0.01; v.ctl.harpoon = false;
      return true;
    }
    if (rig) g.set(rig.wx, v.pos.y, rig.wz);
    if (dRig < 9) Object.assign(v.ctl, { throttle: 0, brake: 1, steer: 0, handbrake: true, turbo: false });
    else driveTo(v, g, dt, { maxSpeed: dRig < 40 ? 8 : 24 });
    holdFire(v, g);
    return true;
  }

  // A built piece in the way: rocket it from range, ram it, back off and ram again.
  function breachPiece(v, b, wall, dt) {
    b.raidState = "breach";
    const d = Math.hypot(wall.wx - v.pos.x, wall.wz - v.pos.z);
    if (d < 6 && !(b.backT > 0)) b.backT = 1.6;
    if (b.backT > 0) { b.backT -= dt; Object.assign(v.ctl, { throttle: 0, brake: 1, steer: 0, handbrake: false, turbo: false }); }
    else driveTo(v, g.set(wall.wx, v.pos.y, wall.wz), dt, { maxSpeed: 20, turbo: d < 30 });
    v.aimPoint.copy(aim.set(wall.wx, wall.wy + 1.2, wall.wz)); v.lockTarget = null;
    v.ctl.fire = d < 90; v.ctl.rockets = d < 120 && d > 12 && Math.random() < 0.05; v.ctl.harpoon = false;
    return true;
  }

  // Siphon holds, computed by every browser from positions so the red ring shows for everyone.
  function siphons(dt) {
    for (const p of plots.list) {
      const rig = p.owner && !p.dark ? modules.rigOf(p.id) : null;
      if (!rig) { delete holds[p.id]; continue; }
      let h = holds[p.id];
      const inside = (v) => v && v.alive && !base.isOwner(p, v) && v.team !== "cisterner" && Math.hypot(v.pos.x - rig.wx, v.pos.z - rig.wz) < RANGE;
      if (!h || !inside(h.v)) {
        const v = game.vehicles.filter(inside).sort((a, c) => Math.hypot(a.pos.x - rig.wx, a.pos.z - rig.wz) - Math.hypot(c.pos.x - rig.wx, c.pos.z - rig.wz))[0];
        h = holds[p.id] = v ? { v, t: 0 } : null;
      }
      if (!h) { modules.setSiphon(rig, 0); continue; }
      h.t += dt;
      modules.setSiphon(rig, h.t / HOLD);
      if (p.owner.id === game.selfId() && h.t > 1 && !h.warned) { h.warned = true; base.alertMine(`${h.v.name} is siphoning the Rig!`, h.v.pos); }
      if (h.t >= HOLD) {
        const v = h.v;
        h.t = 0; h.warned = false;
        if (v === game.player) send("siphon", { plot: p.id });
        else if (!v.remote && net.isHost()) send("siphon", { plot: p.id, ai: game.netSync.nid(v), name: v.name });
      }
    }
  }

  function onSiphoned(by, amount) {
    const v = game.vehicles.find((x) => !x.remote && x !== game.player && x.netId === by);
    if (!v) return;
    v.siphoned = (v.siphoned || 0) + amount;
    if (v.brain) { v.brain.raidState = "escape"; v.brain.escapeT = 0; }
  }

  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => {
    onWreck(v, attacker);
    if (v.siphoned > 0 && !v.remote && v !== game.player) {
      for (let i = 0; i < 3; i++) base.spawnCrate(v.pos.x + (Math.random() - 0.5) * 4, v.pos.y + 1, v.pos.z + (Math.random() - 0.5) * 4, v.siphoned / 3);
      if (attacker === game.player) game.callout("STASH RECOVERED", `${Math.round(v.siphoned)} scrap in crates`, "#7fe0a0");
      v.siphoned = 0;
    }
  };

  return {
    drive, onSiphoned,
    step(dt) {
      if (net.isHost()) {
        if (!game.ruleSys || game.ruleSys.rules().raids) schedule(dt);
        for (const v of game.vehicles) if (v.alive && !v.remote && v.team === "rattler" && v.brain && v.brain.raid && !v.brain.fort && !drive(v, dt)) v.brain.mode = "patrol"; // fort guards: fortress.js
      }
      siphons(dt);
    },
    raidNow() { const list = plots.list.filter((p) => p.owner && !p.dark); for (const p of list) wave(p); return list.map((p) => p.id); },
    hold: (plotId) => (holds[plotId] ? { by: holds[plotId].v.name, k: holds[plotId].t / HOLD } : null),
    raiders: (plotId) => game.vehicles.filter((v) => v.alive && v.brain && v.brain.raid === plotId).length,
    reset() { for (const k in holds) delete holds[k]; for (const p of plots.list) { p.nextRaid = null; p.waves = 0; } },
  };
}