// Builds a race world (a layout from maps/race/raceLayout.js) for the map loader: the ground to the horizon, the
// floor and its collider, an unseen fence round the edge, water, the mountain (if the layout has one), the layout's
// pieces, the chunked city, and the track itself through the track tools (game.tracks). Race worlds stand far east
// of the free-roam world, so they can be as wide as they like and never sit over a safe zone.
import * as THREE from "three";
import { createKit } from "@/game/world/places/kit";
import { deckSite } from "@/game/maps/deck";
import { buildPieces } from "@/game/maps/buildPieces";
import { buildChunks } from "@/game/maps/race/chunks";
import { buildTerrainMesh } from "@/game/maps/race/terrainMesh";

const EAST = 3600, GRID = 12;

export function buildRaceWorld(game, def, L, mat) {
  const C = game.world.colliders, M = game.M, S = { x: EAST, z: 0, y: deckSite(game).y };
  const group = new THREE.Group(), ids = [];
  group.name = `map:${def.id}`;
  game.scene.add(group);
  const add = (b) => { const e = C.add(b); ids.push(e.id); return e; };
  const kit = createKit(group, M, { add }, game.world.terrain), F = kit.frame(S.x, S.y, S.z, 0);
  const [hx, hz] = L.half;
  F.box(mat(L.outer || L.floor), 0, -1.06, 0, 2 * hx + 2400, 2, 2 * hz + 2400);
  F.box(mat(L.floor), 0, -1, 0, 2 * hx, 2, 2 * hz);
  F.collider(0, -2, 0, 2 * hx + 20, 4, 2 * hz + 20, 0, { tag: "arenaFloor" });
  for (const [x, z, w, d] of [[hx + 1, 0, 2, 2 * hz + 4], [-hx - 1, 0, 2, 2 * hz + 4], [0, hz + 1, 2 * hx + 4, 2], [0, -hz - 1, 2 * hx + 4, 2]]) {
    F.collider(x, 100, z, w, 220, d, 0, { noRay: true, tag: "arenaFence" });
  }
  if (L.water) F.box(M.water, 0, L.water - 0.5, 0, 2 * hx + 2400, 1, 2 * hz + 2400);
  buildPieces(F, L, mat, S.y);
  kit.finalize();
  if (L.terrain) group.add(buildTerrainMesh(L, M.rock, S));
  const chunks = buildChunks(game, group, L, S, add);

  const points = L.track.points.map((p) => ({ ...p, x: p.x + S.x, z: p.z + S.z }));
  const track = game.tracks.open({ ...L.track, id: def.id, name: def.name, points }, { ground: () => S.y, fall: L.fall || 0 });
  const W = (list) => list.map((p) => ({ ...p, x: S.x + p.x, z: S.z + p.z, y: S.y + (p.y || 0) }));
  const entry = {
    id: def.id, world: true, track: true, name: def.name, layout: L, ctx: { site: { x: S.x, z: S.z, R: Math.hypot(hx, hz) }, R: Math.hypot(hx, hz), floorY: S.y },
    cps: track.checkpoints.map((c) => ({ x: c.x, y: c.y, z: c.z })), spawns: Array.from({ length: GRID }, (_, k) => track.grid(k)),
    power: W(L.power), horde: W(L.horde), props: W(L.props),
  };
  return { id: def.id, group, ids, entry, x: S.x, z: S.z, chunks, close() { game.tracks.close(); chunks.dispose(); } };
}