// Builds an aircraft as a regular game vehicle (so guns, damage, AI, turrets, explosions and the HUD all see it),
// then swaps in the aircraft mesh, hitbox, weapons and its own kinematic Rapier body. game.js skips car physics
// for vehicles flagged v.air; the flight controller moves them instead.
import * as THREE from "three";
import { createVehicle, placeVehicle } from "@/game/vehicles/vehicle";
import { statsFor } from "@/game/air/tiers";
import { buildHeliMesh } from "@/game/air/heliMesh";
import { buildJetMesh } from "@/game/air/jetMesh";
import { createAirBody } from "@/game/air/body";
import { createFlightState } from "@/game/air/flight";

export function createAircraft(game, kind, { tiers = {}, paint, pos, yaw = 0, team = "player", name = "You" } = {}) {
  const st = statsFor(kind, tiers);
  const v = createVehicle(game, "brawler", { team, name, loadout: { m1: "rockets", s1: "mg" }, hull: st.hull, paint: paint || "#c7762e", plate: kind === "jet" ? "ADM-1" : "AIR-1" });
  for (const c of v.mesh.root.children) c.visible = false; // the car body stays as a hidden carrier
  const am = kind === "heli" ? buildHeliMesh(game.M, { paint, tier: st.look }) : buildJetMesh(game.M, { paint });
  v.mesh.root.add(am.group);
  for (const m of v.mesh.mounts) {
    const at = m.weaponId === "mg" ? am.hard.gun : am.hard.rockets;
    am.group.add(m.model.root);
    m.model.root.position.set(...at);
    m.model.root.rotation.set(0, 0, Math.PI); // hung under the belly: turret aim works upside down
  }
  for (const w of v.weapons) { w.def = w.id === "mg" ? st.gunDef : st.rocketDef; w.ammo = w.def.count || 1; }
  v.mesh.parts = []; v.mesh.wheels = []; v.mesh.flames = [];
  v.chassis = { ...v.chassis, hit: st.hit, engineSound: st.sound, exhausts: [] };
  v.stats = { ...v.stats, name: st.name, topSpeed: st.topSpeed, hull: st.hull, kind: "air" };
  v.mass = st.mass; v.loadMass = 0; v.ram = false;
  v.air = kind; v.airMesh = am; v.airStats = st;
  v.fuelMax = st.fuelTank; v.fuel = st.fuelTank; v.fuelUse = 0; v.fuelInit = true;
  v.skill = { spread: 0.02, react: 0.2, aggression: 0.8, turbo: 0.9 }; v.skillName = "you";
  v.grounded = true; v.contacts = 0;
  const p = pos || new THREE.Vector3();
  placeVehicle(v, p.x, p.y, p.z, yaw);
  v.flight = createFlightState(kind, p, yaw);
  const F = v.flight.stats, k = st.agility;
  if (kind === "heli") { F.accel *= k; F.climb *= k; F.descend *= k; F.yawRate *= k; F.tiltRate *= k; F.drag /= Math.sqrt(k); }
  v.body = createAirBody(game.world, st.hit);
  return v;
}