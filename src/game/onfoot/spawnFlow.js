// "Choose your ride": opens at the start of a session and after every wreck (and as the summon list on foot).
// Pick a spawn point (a safe zone you have visited) and a car: a FREE one parked there (always ready) or one of
// your own (a wrecked one needs its repair paid, or waits out a short cooldown). Scripted modes, the demo, the
// autopilot and arenas skip it and respawn straight away as before.
import { ownedRides, rideStatus, payRepair } from "@/game/onfoot/ownedRoster";
import { garageDoor } from "@/game/onfoot/landmarks";
import { createShowcaseRides } from "@/game/onfoot/showcaseRides";

export function createSpawnFlow(game, { points, free, rides, foot }) {
  const st = { open: false, reason: null, zoneId: null };
  const m = game.modes;
  const enabled = () => !(m.test || m.accel || m.selfcheck || m.autoplay || m.bikecheck) && !game.arena.active && !game.demo.running && !game.autopilot && !(game.big && game.big.active); // the Ashmark has no safe zones yet
  const respawnNow = game.requestRespawn;
  const show = createShowcaseRides(game); // round 13: the free showcase set

  function open(reason = "wreck", zoneId = null) {
    if (reason !== "summon" && !enabled()) return false;
    Object.assign(st, { open: true, reason, zoneId });
    game.emit({ type: "spawnMenu", on: true, reason });
    return true;
  }
  function close() {
    if (!st.open) return;
    st.open = false;
    game.emit({ type: "spawnMenu", on: false });
  }
  game.requestRespawn = () => { if (st.open) return; if (!open("wreck")) respawnNow(); };

  function freeCars(zoneId) {
    return free.at(zoneId).map((v) => ({ id: v.id, name: v.stats.name, chassis: v.chassisId, weapons: v.weapons.map((w) => w.def.name), hull: v.maxHull }));
  }

  function options(zoneId = st.zoneId) {
    const pts = points.list(), zone = points.get(zoneId || pts[0].id);
    const summon = st.reason === "summon";
    return {
      open: st.open, reason: st.reason, zoneId: zone.id, banked: game.save.banked,
      points: summon ? pts.filter((p) => p.id === zone.id) : pts.map((p) => ({ ...p, free: free.at(p.id).length })),
      free: summon ? [] : freeCars(zone.id),
      garage: ownedRides(game.save),
      showcase: show.list(),
    };
  }

  function after(v, zone) {
    close();
    game.introT = 0;
    foot.toDriving();
    game.cam.snap(v);
    game.respawnIn = 0;
    game.callout(st.reason === "start" ? "HIT THE ROAD" : "BACK ON THE ROAD", zone.name, "#f2c230");
    game.emit({ type: "respawned" });
  }

  // vehicleId: a free car's id (number, "free:<id>", or "free" for the first one there) or an owned chassis id.
  // o.repair: pay the repair of a wrecked owned car first. Returns { ok, reason?, wait?, cost? }.
  function choose(pointId, vehicleId, o = {}) {
    const zone = points.get(pointId || st.zoneId);
    if (!zone) return { ok: false, reason: "point" };
    const s = String(vehicleId ?? "free");
    // At the start the car beginPlay put at the gate is only a placeholder behind the menu.
    const dropStart = () => { if (st.reason === "start" && game.player && !game.player.free && game.vehicles.includes(game.player)) game.dropPlayer(); };
    if (st.reason !== "summon" && (s === "free" || s.startsWith("free:") || /^\d+$/.test(s))) {
      const list = free.at(zone.id), id = +s.replace("free:", "");
      const v = s === "free" ? list[0] : list.find((x) => x.id === id);
      if (!v) return { ok: false, reason: "noFree" };
      dropStart();
      rides.drive(v);
      after(v, zone);
      return { ok: true, vehicle: v.id, free: true };
    }
    if (s.startsWith("show:")) {
      // A showcase vehicle (free, one copy of each): rolls out of the garage door like an owned car.
      const id = s.slice(5), status = show.status(id);
      if (!status.ready) return { ok: false, reason: "wrecked", wait: status.wait };
      const door = garageDoor(game, zone);
      if (st.reason !== "summon") dropStart();
      const v = show.roll(id, door);
      if (!v) return { ok: false, reason: "notOwned" };
      if (st.reason === "summon") {
        v.summoned = true; rides.park(v); v.ctl.handbrake = !v.rollT;
        close();
        game.emit({ type: "minor", text: `${v.showName.toUpperCase()} ROLLING OUT` });
        return { ok: true, vehicle: v.id, summoned: true, showcase: id };
      }
      rides.drive(v);
      after(v, zone);
      return { ok: true, vehicle: v.id, free: true, showcase: id };
    }
    if (!game.save.garage.owned.chassis.includes(s)) return { ok: false, reason: "notOwned" };
    const status = rideStatus(game.save, s);
    if (!status.ready && !(o.repair && payRepair(game, s))) return { ok: false, reason: o.repair ? "scrap" : "wrecked", wait: status.wait, cost: status.cost };
    const door = garageDoor(game, zone);
    if (st.reason === "summon") {
      const v = rides.summon(s, door);
      close();
      game.emit({ type: "minor", text: `${v.stats.name.toUpperCase()} ROLLING OUT` });
      return { ok: true, vehicle: v.id, summoned: true };
    }
    dropStart();
    const v = rides.drive(rides.rollOut(s, door));
    after(v, zone);
    return { ok: true, vehicle: v.id, free: false };
  }

  return { open, close, options, choose, enabled, isOpen: () => st.open, reason: () => st.reason };
}