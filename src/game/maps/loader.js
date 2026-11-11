// The map loader (round 15): swaps the whole world for a world map and back. load(id) hides the free-roam world
// (terrain, town, roads, scatter, labels), builds the map on its deck (ground to the horizon, the floor, the wall and
// fence, far mesas, the layout's pieces and its landmark), sets the map's sky and light and returns the arena entry
// (spawns, checkpoints, power-ups, horde points, breakable props). The minimap follows current(). unload() takes the
// map down, shows free roam again and hands back where you were in it (kept every second while you drive there),
// and resumeRoam() puts you back there when you next start Free Roam solo. The loading screen is the menus'
// (ui/play/useMapLoading.js): it paints first and the build runs behind it.
import * as THREE from "three";
import { createKit } from "@/game/world/places/kit";
import { mapById, layoutOf } from "@/game/maps/catalog";
import { deckSite, buildDeck } from "@/game/maps/deck";
import { buildPieces } from "@/game/maps/buildPieces";
import { createMapSky } from "@/game/maps/mapSky";
import { buildRaceWorld } from "@/game/maps/race/raceWorld";
import { net } from "@/game/net/net";
import "@/game/maps/worlds";

export function createMapLoader(game) {
  const C = game.world.colliders, sky = createMapSky(game), M = game.M;
  let cur = null, lastRoam = null, resume = null, roamT = 0;
  const lit = new Map(); // "lit:#hex": a glowing colour (reactor green, strip lights), made once
  const glow = (k) => { if (!lit.has(k)) lit.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(k.slice(4)).multiplyScalar(4), toneMapped: false })); return lit.get(k); };
  const mat = (k) => (!k ? M.rust : k.startsWith("lit:") ? glow(k) : k[0] === "#" ? M.paint(k) : M[k] && typeof M[k] !== "function" ? M[k] : M.rust);
  const showRoam = (on) => { for (const o of game.roamObjects) o.visible = on; };
  const fwd = new THREE.Vector3();
  const poseOf = (v) => { fwd.set(0, 0, -1).applyQuaternion(v.quat); return { x: v.pos.x, y: v.pos.y - 0.9, z: v.pos.z, heading: Math.atan2(-fwd.x, -fwd.z) }; };

  function build(id) {
    const def = mapById(id), L = layoutOf(id), S = def.site ? def.site(deckSite(game)) : deckSite(game); // a map may move its own deck
    if (L.track) return buildRaceWorld(game, def, L, mat); // a race world: maps/race/raceWorld.js
    const group = new THREE.Group();
    group.name = `map:${id}`;
    game.scene.add(group);
    const ids = [], coll = { add: (b) => { const e = C.add(b); ids.push(e.id); return e; } };
    const kit = createKit(group, M, coll, game.world.terrain), F = kit.frame(S.x, S.y, S.z, 0);
    buildDeck(F, M, L, mat);
    buildPieces(F, L, mat, S.y);
    kit.finalize();
    const extra = def.extra ? def.extra({ game, group, F, S, L, M, coll }) : null; // a map's own runtime (maps/city)
    const W = (list) => list.map((p) => ({ ...p, x: S.x + p.x, z: S.z + p.z, y: S.y + (p.y || 0) }));
    const entry = { id, world: true, name: def.name, layout: L, ctx: { site: { x: S.x, z: S.z, R: L.R }, R: L.R, floorY: S.y },
      cps: W(L.checkpoints), power: W(L.power), spawns: W(L.spawns), horde: W(L.horde), props: W(L.props) };
    return { id, group, ids, entry, x: S.x, z: S.z, extra };
  }
  function drop() {
    if (cur.close) cur.close();
    if (cur.extra) cur.extra.dispose();
    game.scene.remove(cur.group);
    cur.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const i of cur.ids) C.removeById(i);
    cur = null;
  }

  const api = {
    load(id) {
      if (cur && cur.id === id) return cur.entry;
      if (cur) drop();
      cur = build(id);
      showRoam(false);
      sky.enter(cur.entry.layout.sky);
      return cur.entry;
    },
    // Back to free roam: returns the pose you had there (null if you never drove in free roam this session).
    unload() {
      if (!cur) return null;
      drop();
      showRoam(true);
      sky.leave();
      resume = lastRoam;
      return lastRoam;
    },
    resumeRoam() {
      const p = resume;
      resume = null;
      if (!p || net.mode === "online" || cur || game.big.active) return false;
      game.onfoot.spawn.close();
      game.respawnPlayer(p);
      game.startIntro(false);
      return true;
    },
    current: () => (cur ? { id: cur.id, x: cur.x, z: cur.z } : null),
    step(dt) {
      if (cur && cur.extra) cur.extra.step(dt);
      roamT -= dt;
      const p = game.player;
      if (cur || roamT > 0 || !p || !p.alive || game.big.active || game.arena.active || game.demo.running || game.introT > 0) return;
      roamT = 1;
      lastRoam = poseOf(p);
    },
    frame() { if (cur && cur.chunks) cur.chunks.update(game.camera.position); }, // the city's near and far sets
    dispose() { if (cur) { drop(); showRoam(true); } sky.dispose(); },
  };
  return api;
}