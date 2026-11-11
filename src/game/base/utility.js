// Non-weapon module behaviour: gates open for their owner, garage pads repair, refineries fill the stash
// (offline; the server does it online), radar masts raise the alarm at 300 m, spike walls bite.
import { net } from "@/game/net/net";
import { BASE } from "@/game/data/tuning";
import { applyDamage } from "@/game/net/damage";

const PAD = BASE.modules.garagepad, REF = BASE.modules.refinery, RADAR = BASE.modules.radar;

export function createUtility(game) {
  const base = game.base, { modules, plots } = base;
  let labelT = 0, radarT = 0;

  const local = (e, v) => {
    const c = Math.cos(e.yaw), s = Math.sin(e.yaw), dx = v.pos.x - e.wx, dz = v.pos.z - e.wz;
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  };

  function gate(e) {
    const owner = base.ownerVehicle(e.plotRef);
    const near = owner && owner.alive && Math.hypot(owner.pos.x - e.wx, owner.pos.z - e.wz) < 9;
    const door = e.boxes.find((b) => b.role === "door");
    if (near && door) { game.world.colliders.remove(door); e.boxes.splice(e.boxes.indexOf(door), 1); game.audio.impact(owner.pos, 0.3); }
    else if (!near && !door && e.alive) {
      const blocking = game.vehicles.some((v) => v.alive && Math.abs(local(e, v).x) < 1.8 && Math.abs(local(e, v).z) < 1.6);
      if (!blocking) modules.addBox(e, [0, 1.45, 0, 1.5, 1.45, 0.25, "door"]);
    }
    const open = !e.boxes.some((b) => b.role === "door");
    const y = e.o.door.position.y, target = open ? 2.7 : 0;
    e.o.door.position.y = y + (target - y) * 0.15;
  }

  function pad(e, dt) {
    const p = game.player;
    if (!p.alive || e.plotRef.dark || !base.isOwner(e.plotRef, p) || p.vel.length() > 1.5) return;
    const l = local(e, p);
    if (Math.abs(l.x) > 3 || Math.abs(l.z) > 3) return;
    if (p.hull < p.maxHull) {
      p.hull = Math.min(p.maxHull, p.hull + PAD.repair * dt);
      if (Math.random() < 0.3) game.particles.sparks(p.pos.x + (Math.random() - 0.5) * 2, p.pos.y + 0.8, p.pos.z + (Math.random() - 0.5) * 2, 3);
      p.padRepair = true;
    }
  }

  function spikes(e, dt) {
    for (const v of game.vehicles) {
      if (!v.alive || v.remote || base.isOwner(e.plotRef, v)) continue;
      const l = local(e, v);
      if (Math.abs(l.x) > 1.6 || Math.abs(l.z) > 1.7) continue;
      const sp = v.vel.length();
      applyDamage(game, v, (25 + sp * 6) * dt, v.pos, null, { weapon: "spikeWall", blunt: true });
      if (Math.random() < 0.4) game.particles.sparks(v.pos.x, v.pos.y + 0.4, v.pos.z, 4);
      if (v === game.player && Math.random() < dt * 3) game.audio.impact(v.pos, 0.4);
    }
  }

  function radar(dt) {
    radarT -= dt;
    if (radarT > 0) return;
    radarT = 2;
    const p = base.mine();
    if (!p || p.dark || !modules.forPlot(p.id).some((e) => e.kind === "radar")) return;
    const foe = game.vehicles.find((v) => v.alive && (v.team === "rattler" || (v.brain && v.brain.raid === p.id) || v.team === "warlord") && Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < RADAR.range);
    if (foe && game.time - (p.radarAt || -99) > 30) {
      p.radarAt = game.time;
      base.alertMine(`Radar contact: ${foe.name} closing on the base.`, foe.pos);
    }
  }

  function step(dt) {
    game.player.padRepair = false;
    for (const e of modules.list) {
      if (!e.alive) continue;
      if (e.kind === "gate") gate(e);
      else if (e.kind === "garagepad") pad(e, dt);
      else if (e.kind === "spikewall") spikes(e, dt);
      else if (e.kind === "refinery" && net.mode !== "online" && !e.plotRef.dark && modules.rigOf(e.plot)) e.plotRef.stash += REF.rate * dt;
    }
    radar(dt);
    labelT -= dt;
    if (labelT <= 0) { labelT = 0.5; for (const p of plots.list) if (p.owner) base.labelRig(p); }
  }

  return { step };
}