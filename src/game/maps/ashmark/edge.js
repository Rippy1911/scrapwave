// The Ashmark's edge is the land itself, never a flat wall: the Spine's walls in the north, deep dunes in the east
// and sea cliffs in the west and south. This keeps cars on the map without one: over the last 150 m the sand, scree
// or surf drags harder and harder and eases the car back, and a car that sits in deep water (more than 2.5 m) for
// two seconds is washed ashore on the nearest dry ground toward the middle of the map. Aircraft are held by
// air/control.js. Vehicles that are not on this map (parked in the hidden Saltreach) are left alone.
import { ASH, toMapX, toMapZ } from "@/game/maps/ashmark/layout";
import { heightAt } from "@/game/maps/ashmark/height";
import { placeVehicle } from "@/game/vehicles/vehicle";

const BAND = ASH.half - ASH.play; // 150 m

export function createEdge(game) {
  function ashore(v) {
    const dx = ASH.site.x - v.pos.x, dz = ASH.site.z - v.pos.z, l = Math.hypot(dx, dz) || 1;
    let x = v.pos.x, z = v.pos.z;
    for (let k = 0; k < 100 && heightAt(x, z) < ASH.sea + 1; k++) { x += (dx / l) * 15; z += (dz / l) * 15; }
    placeVehicle(v, x, heightAt(x, z) + 1.4, z, Math.atan2(-dx, -dz));
    v.ashWet = 0;
    if (v === game.player) { game.cam.snap(v); game.emit({ type: "minor", text: "WASHED ASHORE" }); }
  }
  return {
    step(dt) {
      for (const v of game.vehicles) {
        if (v.remote || !v.alive || v.air) continue;
        const mx = toMapX(v.pos.x), mz = toMapZ(v.pos.z), out = Math.max(Math.abs(mx), Math.abs(mz)) - ASH.play;
        if (out > BAND + 300) continue;
        if (out > 0) {
          const k = Math.min(1, out / (BAND - 20)), drag = Math.max(0, 1 - k * k * 5 * dt), push = k * k * 22 * dt;
          v.vel.x *= drag; v.vel.z *= drag;
          if (Math.abs(mx) > Math.abs(mz)) v.vel.x -= Math.sign(mx) * push; else v.vel.z -= Math.sign(mz) * push;
        }
        const deep = v.pos.y < ASH.sea - 0.6 && heightAt(v.pos.x, v.pos.z) < ASH.sea - 2.5;
        v.ashWet = deep ? (v.ashWet || 0) + dt : 0;
        if (v.ashWet > 2) ashore(v);
      }
    },
  };
}