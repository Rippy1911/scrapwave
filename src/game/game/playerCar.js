// The player's car: build from the garage save, rebuild after garage changes, and (re)spawn on the open road.
// Round 9: the player can also be in a car they got into on foot (a FREE car or one summoned from the garage):
// buildOwnedCar() builds a garage car without driving it, adoptPlayer(v) makes any car the player's, and
// requestRespawn() is what the wreck timer calls (the on-foot layer turns it into the "Choose your ride" screen).
import * as THREE from "three";
import { MINES, FUEL } from "@/game/data/tuning";
import { SPAWN } from "@/game/data/places";
import { createVehicle, placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";
import { roadSpawn } from "@/game/world/spawn";
import { createNameTag } from "@/game/vehicles/nametag";

export function attachPlayerCar(game) {
  const { save } = game;

  // Player-only fields; free cars get no modules.
  function outfit(v, mods) {
    v.mines = mods.includes("mines"); v.minesLeft = MINES.count; v.smokeModule = mods.includes("smoke");
    v.skill = { spread: 0.02, react: 0.2, aggression: 0.8, turbo: 0.9 };
    v.skillName = "you";
    v.fuelMax = FUEL.tank * (mods.includes("bigtank") ? FUEL.bigTankMul : 1);
    v.fuelUse = mods.includes("efficient") ? FUEL.efficientMul : 1;
    v.fuel = v.fuelMax;
  }
  // No chassis given: the current ride (the Workshop's built design when it is the ride, else the garage car).
  // A chassis given (summon / Choose your ride): that garage car.
  function buildOwnedCar(pose, chassis) {
    const g = save.garage, mods = g.owned.modules, ch = chassis || g.chassis;
    const lo = { ...g.loadouts[ch], ram: !!(g.loadouts[ch].ram && g.owned.ram) };
    const tier = g.armour[ch];
    const armour = tier ? { front: tier, rear: tier, left: tier, right: tier, top: tier } : {};
    const own = { team: "player", name: "You", plate: "SW-01", nitro: mods.includes("nitro"), welder: mods.includes("welder") };
    const v = (!chassis && game.workshop && game.workshop.makeCar(own)) || createVehicle(game, ch, { ...own, paint: g.paint, paint2: "#3a3734", loadout: lo, armour });
    v.owned = true;
    outfit(v, mods);
    if (game.workshop) game.workshop.fit(v); // upgrade tiers (Tier I leaves the car as it is)
    placeVehicle(v, pose.x, pose.y + 1.2, pose.z, pose.heading);
    game.vehicles.push(v);
    return v;
  }
  function setPlayer(v) {
    v.team = "player"; v.name = "You";
    game.player = v;
    if (game.autopilot) createNameTag(game, v, "AUTOPILOT", "#9cc8ff", false);
    return v;
  }
  function makePlayer(pose) {
    return setPlayer(buildOwnedCar(pose));
  }
  function dropPlayer() {
    const old = game.player;
    if (!old) return;
    const i = game.vehicles.indexOf(old);
    if (i >= 0) game.vehicles.splice(i, 1);
    removeVehicle(game, old);
  }
  // Spawn pose on the highway outside the gate; Mammoth gets extra clearance for its length.
  game.spawnPose = () => roadSpawn(game.world, SPAWN.town, game.vehicles.filter((v) => v !== game.player), { chassis: { hit: { half: [0, 0, (game.workshop && game.workshop.spawnHalf()) || chassisHalf(save.garage.chassis)] } } });
  game.buildOwnedCar = buildOwnedCar;
  game.outfitCar = outfit; // showcase vehicles (onfoot/showcaseRides.js) get the same player fields
  game.dropPlayer = dropPlayer;
  game.adoptPlayer = (v) => {
    if (v.free) outfit(v, []);
    else if (v.owned && !v.design) save.garage.chassis = v.chassisId; // the garage follows the car you drive (built designs aren't garage chassis)
    return setPlayer(v);
  };

  game.rebuildPlayer = () => {
    const old = game.player;
    if (old.free) return; // free cars cannot be modified
    const pos = old.pos.clone(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(old.quat), scrap = old.scrap, turbo = old.turbo, fuelK = old.fuel / old.fuelMax;
    dropPlayer();
    const v = makePlayer({ x: pos.x, y: pos.y - 0.9, z: pos.z, heading: Math.atan2(-fwd.x, -fwd.z) });
    v.scrap = scrap; v.turbo = turbo; v.fuel = v.fuelMax * fuelK;
  };
  game.respawnPlayer = (pose = game.spawnPose()) => {
    dropPlayer();
    makePlayer(pose);
    game.cam.snap(game.player);
    game.emit({ type: "respawned" });
    return game.player;
  };
  game.requestRespawn = () => game.respawnPlayer();
  return makePlayer;
}

const chassisHalf = (id) => (id === "mammoth" ? 5.3 : id === "bulwark" ? 3.25 : id === "brawler" ? 2.55 : 1.95);