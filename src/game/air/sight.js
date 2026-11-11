// Line of sight for aircraft: the AI's rule (no collider between the two) plus the terrain, sampled along the
// line, so a lock or a shot never goes through a hill.
import * as THREE from "three";
import { lineOfSight } from "@/game/ai/steer";

const d = new THREE.Vector3();

export function clearSight(game, from, to) {
  const dist = from.pos.distanceTo(to.pos);
  if (!lineOfSight(game, from, to, dist)) return false;
  d.subVectors(to.pos, from.pos).divideScalar(Math.max(1e-3, dist));
  const T = game.world.terrain;
  for (let t = 3; t < dist - 2; t += 4) {
    const x = from.pos.x + d.x * t, y = from.pos.y + d.y * t, z = from.pos.z + d.z * t;
    if (y < T.heightAt(x, z) - 0.3) return false;
  }
  return true;
}