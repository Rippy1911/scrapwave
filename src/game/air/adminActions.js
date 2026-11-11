// What the admin panel does. Every action re-checks isAdmin(), so nothing here works for normal players.
import * as THREE from "three";
import { PLACES } from "@/game/data/places";
import { VEHICLES } from "@/game/data/tuning";
import { LOADOUTS } from "@/game/data/vehicles";
import { createVehicle, placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";
import { writeSave } from "@/game/core/save";
import { isAdmin } from "@/game/air/admin";

export const ADMIN_CARS = ["jackal", "brawler", "mammoth", "buggy", "pickup", "tanker"].filter((id) => VEHICLES[id]);
export const ADMIN_PLACES = PLACES.map((p) => ({ id: p.id, name: p.name }));

export function adminActions(game) {
  const ok = () => isAdmin() && game.player;
  return {
    // Swap your car for any chassis where you stand (from an aircraft: get out first).
    car(id) {
      if (!ok() || !VEHICLES[id]) return false;
      if (game.air.active()) game.air.exit(true);
      const old = game.player, yaw = new THREE.Euler().setFromQuaternion(old.quat, "YXZ").y;
      const v = createVehicle(game, id, { team: "player", name: "You", loadout: { ...LOADOUTS[id] }, paint: game.save.garage.paint, plate: "ADM-0" });
      v.skill = old.skill; v.skillName = "you"; v.scrap = old.scrap; v.god = !!old.god;
      placeVehicle(v, old.pos.x, old.pos.y + 1, old.pos.z, yaw);
      game.vehicles.splice(game.vehicles.indexOf(old), 1);
      removeVehicle(game, old);
      game.vehicles.push(v);
      game.player = v;
      game.cam.snap(v);
      return true;
    },
    air(kind) { return ok() ? game.air.spawn(kind) : { ok: false, msg: "Admin only" }; },
    // The ready-made heavy walker where you stand, folding straight into Walker mode.
    wreckframe() {
      if (!ok()) return false;
      if (game.air.active()) game.air.exit(true);
      return game.mech.rideWreckframe(true);
    },
    scrap(n) {
      if (!ok()) return false;
      game.save.banked += Math.round(n);
      if (!game.noSave) writeSave(game.save);
      return game.save.banked;
    },
    god(on) { if (!ok()) return false; game.player.god = !!on; return game.player.god; },
    godOn: () => !!(game.player && game.player.god),
    teleport(placeId) {
      if (!ok()) return false;
      const pl = PLACES.find((p) => p.id === placeId);
      if (!pl) return false;
      if (game.air.active()) return game.air.moveTo(pl.x, pl.z);
      return !!window.scrapwake?.teleport(placeId);
    },
  };
}