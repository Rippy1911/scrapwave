// Getting in and out. Boarding parks your car out of the world (body and mesh removed, state kept) and puts you in
// a freshly spawned aircraft beside it; getting out puts the same car back on the ground beside the aircraft.
import * as THREE from "three";
import { placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";
import { removeBody } from "@/game/vehicles/physics";
import { nearestRoadPose } from "@/game/world/spawn";
import { createAircraft } from "@/game/air/craft";
import { FLIGHT } from "@/game/air/flight";

const right = new THREE.Vector3();

// Where an aircraft appears: helicopter 8 m to the right of the car, jet on the nearest road, facing along it.
function spawnPose(game, kind, car) {
  const w = game.world;
  const yaw = new THREE.Euler().setFromQuaternion(car.quat, "YXZ").y;
  if (kind === "jet") {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(car.quat);
    const r = nearestRoadPose(w, car.pos.x, car.pos.z, f.x, f.z, game.vehicles, car);
    return { x: r.x, z: r.z, yaw: r.heading, y: w.groundAt(r.x, r.z, r.y + 3) + FLIGHT.jet.gear };
  }
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const x = car.pos.x + right.x * 8, z = car.pos.z + right.z * 8;
  return { x, z, yaw, y: w.groundAt(x, z, car.pos.y + 25) + FLIGHT.heli.gear };
}

export function board(game, kind, opts = {}) {
  const car = game.player;
  const pose = opts.pose || spawnPose(game, kind, car);
  game.vehicles.splice(game.vehicles.indexOf(car), 1);
  removeBody(car);
  car.mesh.root.removeFromParent();
  const craft = createAircraft(game, kind, { ...opts, pos: new THREE.Vector3(pose.x, pose.y, pose.z), yaw: pose.yaw });
  craft.scrap = car.scrap; car.scrap = 0;
  craft.god = !!car.god;
  if (opts.hp !== undefined && opts.hp !== null) craft.hull = Math.max(1, Math.min(craft.maxHull, opts.hp));
  if (opts.fuel !== undefined && opts.fuel !== null) craft.fuel = Math.min(craft.fuelMax, opts.fuel);
  craft.hullSeen = craft.hull;
  game.vehicles.push(craft);
  game.player = craft;
  return craft;
}

// Car back beside the aircraft (5 m to its right), then the aircraft goes away.
export function unboard(game, craft, car) {
  const w = game.world, s = craft.flight;
  right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
  const x = craft.pos.x + right.x * 5, z = craft.pos.z + right.z * 5;
  const y = w.groundAt(x, z, craft.pos.y + 2) + (car.rideH || 1) + 0.3;
  placeVehicle(car, x, y, z, s.yaw);
  game.scene.add(car.mesh.root);
  car.scrap += craft.scrap;
  car.god = !!craft.god;
  game.vehicles.push(car);
  game.player = car;
  dropCraft(game, craft);
  game.cam.snap(car);
}

export function dropCraft(game, craft) {
  const i = game.vehicles.indexOf(craft);
  if (i >= 0) { game.vehicles.splice(i, 1); removeVehicle(game, craft); }
  craft.body.remove();
}