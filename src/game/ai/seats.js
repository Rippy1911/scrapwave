// Drifter seat balancing (runs where the AI runs, i.e. on the host): about 24 seats minus humans for
// Drifters, at least 6 and at most 10. A Drifter over the target drives off to the map edge and despawns
// there out of sight; a benched Drifter comes back when a seat frees up.
import { net } from "@/game/net/net";
import { removeVehicle } from "@/game/vehicles/vehicle";
import { edgeRoadSpawn } from "@/game/world/spawn";
import { agentDrive } from "@/game/ai/agent";

export const SEATS = { total: 24, min: 6, max: 10 };
export const drifterTarget = (humans) => Math.max(SEATS.min, Math.min(SEATS.max, SEATS.total - humans));

export function createSeats(game, roster) {
  let t = 0;
  const humanNear = (x, z, r) => game.vehicles.some((v) => (v === game.player || v.team === "remote") && Math.hypot(v.pos.x - x, v.pos.z - z) < r);
  const fromPlayer = (e) => Math.hypot(e.v.pos.x - game.player.pos.x, e.v.pos.z - game.player.pos.z);

  function sendAway(e) {
    const pose = edgeRoadSpawn(game.world, game.player.pos, game.vehicles);
    e.leaving = { x: pose.x, z: pose.z, until: game.time + 90 };
    const b = e.v.brain;
    b.raid = null; b.target = null; b.hunting = false; b.payback = false;
  }

  function despawn(e) {
    const i = game.vehicles.indexOf(e.v);
    removeVehicle(game, e.v);
    if (i >= 0) game.vehicles.splice(i, 1);
    e.v = null; e.respawnAt = 0; e.leaving = null;
  }

  function balance() {
    for (const e of roster) if (e.leaving && (!e.v || !e.v.alive)) e.leaving = null;
    const target = Math.min(drifterTarget(net.humans()), game.ruleSys ? game.ruleSys.aiCap() : SEATS.max);
    const seated = roster.filter((e) => !e.leaving && (e.v || e.respawnAt > 0));
    if (seated.length > target) {
      const away = seated.filter((e) => e.v && e.v.alive && !e.v.brain.raid).sort((a, b) => fromPlayer(b) - fromPlayer(a))[0];
      if (away) sendAway(away);
      else { const w = seated.find((e) => !e.v); if (w) w.respawnAt = 0; }
    } else if (seated.length < target) {
      const bench = roster.find((e) => !e.v && e.respawnAt === 0 && !e.leaving);
      if (bench) bench.respawnAt = game.time + 3;
    }
  }

  return {
    update(dt) { t -= dt; if (t <= 0) { t = 1; balance(); } },
    // Drive a leaving Drifter to its edge point; despawn once there (or after 90 s) with no human close by.
    stepLeaving(e, dt) {
      const v = e.v, L = e.leaving, b = v.brain;
      b.mode = "roam"; b.dest = L;
      agentDrive(game, v, dt);
      const d = Math.hypot(v.pos.x - L.x, v.pos.z - L.z);
      if ((d < 40 || game.time > L.until) && !humanNear(v.pos.x, v.pos.z, 150)) despawn(e);
    },
    state: () => ({ humans: net.humans(), target: drifterTarget(net.humans()), seated: roster.filter((e) => !e.leaving && (e.v || e.respawnAt > 0)).length, leaving: roster.filter((e) => e.leaving).map((e) => e.name) }),
  };
}