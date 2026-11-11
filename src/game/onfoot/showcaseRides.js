// Showcase vehicles on the road (round 13): rolling one out of a garage door, its perks (mine racks, extra trap
// charges), and the cooldown after it is wrecked. The list itself lives in workshop/showcase.js.
import { placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";
import { showcaseById, showcaseDesign, showcaseStatus, markShowcaseWrecked, showcaseList } from "@/game/workshop/showcase";
import { slot } from "@/game/traps/charges";
import { TRAP_KINDS } from "@/game/traps/tiers";
import { writeSave } from "@/game/core/save";

export function createShowcaseRides(game) {
  // A wrecked showcase vehicle starts its cooldown (kept in the save so a reload does not skip it).
  const onWreck = game.onWreck;
  game.onWreck = (v, a) => {
    if (v.showcase) { markShowcaseWrecked(game.save, v.showcase); if (!game.noSave) writeSave(game.save); }
    return onWreck(v, a);
  };

  const out = () => game.vehicles.find((v) => v.showcase && v.alive) || null;

  const api = {
    list: () => showcaseList(game.save).map((r) => ({ ...r, out: !!game.vehicles.find((v) => v.showcase === r.id && v.alive) })),
    status: (id) => showcaseStatus(game.save, id),
    // Build it at a pose ({ x, y, z, heading, vx, vz }); not yet the player's car. Returns the vehicle or null.
    roll(id, pose) {
      const s = showcaseById(id);
      if (!s || !showcaseStatus(game.save, s.id).ready) return null;
      // One copy of each: a copy already out in the world is sent home first.
      for (const old of game.vehicles.filter((v) => v.showcase === s.id && v !== game.player)) {
        game.vehicles.splice(game.vehicles.indexOf(old), 1);
        removeVehicle(game, old);
      }
      const v = game.workshop.createDesigned(showcaseDesign(s.id), { team: "player", name: "You", plate: "SHOW-" + (1 + s.id.length) });
      v.owned = true; v.showcase = s.id; v.showName = s.name;
      game.outfitCar(v, s.perks.mines ? ["mines"] : []);
      game.workshop.fit(v);
      if (s.perks.traps) { const st = slot(game, v); for (const k of TRAP_KINDS) st.charges[k] = Math.round(st.charges[k] * s.perks.traps); }
      placeVehicle(v, pose.x, pose.y + 1.2, pose.z, pose.heading);
      v.vel.set(pose.vx || 0, 0, pose.vz || 0);
      v.rollT = pose.vx || pose.vz ? 1.6 : 0;
      game.vehicles.push(v);
      return v;
    },
    current: out,
  };
  game.showcase = api;
  return api;
}