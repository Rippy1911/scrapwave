// The big-world system (game.big): puts the Ashmark Expanse in place of the Saltreach and takes it away again.
// enter(): hides the Saltreach (it stays loaded where it is), points the terrain queries at the Ashmark's height
// function inside the map, clears the open-world AI and starts the tile streamer. leave() undoes all of it.
// Play starts here when the roam map picker asked for an Ashmark map (maps.js wantRoam); any other start leaves.
// While active the open-world systems of the Saltreach (AI, cycle, jobs, convoy, Warlord, Choose your ride) rest.
import { ASH, BIOME_NAME, SPOTS, inMap, tileI, tileJ, toMapX, toMapZ } from "@/game/maps/ashmark/layout";
import { heightAt, normalAt, surfaceAt, biomeAt } from "@/game/maps/ashmark/height";
import { createStreamer, BUDGET_MS } from "@/game/maps/ashmark/streamer";
import { createTileColliders } from "@/game/maps/ashmark/colliders";
import { createEdge } from "@/game/maps/ashmark/edge";
import { isBigMap, peekRoam, takeRoam } from "@/game/maps/ashmark/maps";
import { layRoads, siteAt } from "@/game/maps/ashmark/roads";
import { createSites } from "@/game/maps/ashmark/sitesLive";
import { createAshGfx } from "@/game/engine/three/ashTiles";
import { createAshRoads } from "@/game/engine/three/ashRoads";
import { getPhys } from "@/game/vehicles/rapier";
import { clearAI } from "@/game/rules/population";

const FAR = 16000; // the horizon mesh reaches the far corner of the map
const now = () => performance.now();

export function createBigWorld(game) {
  const T = game.world.terrain, orig = { heightAt: T.heightAt, normalAt: T.normalAt, surfaceAt: T.surfaceAt };
  const colliders = createTileColliders(() => { const P = getPhys(game.world); return P ? P.R : null; });
  const edge = createEdge(game), ms = { last: 0, max: 0 };
  let gfx = null, stream = null, roads = null, sites = null, active = null, hold = null, holdT = 0, updT = 0, rescues = 0;

  const poseAt = (mx, mz, tx, tz) => {
    const x = mx + ASH.site.x, z = mz + ASH.site.z;
    return { x, y: heightAt(x, z), z, heading: Math.atan2(-(tx - mx), -(tz - mz)) };
  };
  // Beside the front of a place's pad looking at it, or 30 m back along the road for a place that stands on one
  // (on its deck when that is a bridge).
  const sitePose = (S) => {
    const c = Math.cos(S.yaw), s = Math.sin(S.yaw), k = S.r > 0 && !S.snap ? S.r - 6 : 0, lx = -0.6 * k, lz = k ? -0.8 * k : 30;
    const pose = poseAt(S.x + lx * c + lz * s, S.z - lx * s + lz * c, S.x, S.z);
    if (S.snap) pose.y = Math.max(pose.y, S.y);
    return pose;
  };
  const spotPose = (name) => { const s = SPOTS[name] || SPOTS.waste; return poseAt(s[0][0], s[0][1], s[1][0], s[1][1]); };
  // Where a new car goes: the start of the biome you are in, or the flats when you are not on the map yet.
  const spawnPose = () => { const p = game.player; return spotPose(p && inMap(p.pos.x, p.pos.z) ? biomeAt(p.pos.x, p.pos.z) : "waste"); };
  const holdHere = () => { const p = game.player; hold = { x: p.pos.x, y: p.pos.y, z: p.pos.z, q: p.quat.clone() }; holdT = 0; updT = 0; };

  function enter(id = "ashmark") {
    if (active) { active = id; return true; }
    const net = layRoads(); // first of all: the roads and pads grade the ground every tile is sampled from
    if (!gfx) {
      gfx = createAshGfx(game.scene, game.T, game.M.water); stream = createStreamer({ gfx, colliders, now });
      roads = createAshRoads(gfx.group, game.M, net); sites = createSites(game, gfx.group, net);
    }
    gfx.build(); gfx.show(true);
    for (const o of game.roamObjects) o.visible = false;
    T.heightAt = (x, z) => (inMap(x, z) ? heightAt(x, z) : orig.heightAt(x, z));
    T.normalAt = (x, z, out) => (inMap(x, z) ? normalAt(x, z, out) : orig.normalAt(x, z, out));
    T.surfaceAt = (x, z) => (inMap(x, z) ? surfaceAt(x, z) : orig.surfaceAt(x, z));
    clearAI(game);
    active = id; rescues = 0; ms.max = 0;
    return true;
  }
  // respawn: a car still standing on the Ashmark goes back to the Saltreach's own spawn.
  function leave(respawn = true) {
    if (!active) return false;
    active = null; hold = null;
    stream.clear(); colliders.clear(); sites.clear(); gfx.show(false);
    for (const o of game.roamObjects) o.visible = true;
    Object.assign(T, orig);
    game.camera.far = game.rend.q.far; game.camera.updateProjectionMatrix();
    if (respawn && inMap(game.player.pos.x, game.player.pos.z)) game.respawnPlayer();
    if (respawn && game.ruleSys) game.ruleSys.syncPopulation();
    return true;
  }
  function teleport(to = "waste") {
    if (!active) enter();
    const S = typeof to === "string" && to !== "start" ? siteAt(to) : null;
    const pose = S ? sitePose(S) : typeof to === "string" ? spotPose(to) : poseAt(to.x, to.z, to.x, to.z - 1);
    game.respawnPlayer(pose);
    game.startIntro(false);
    holdHere();
    return api.state();
  }

  // Session start (every launch from the menus ends here): the picker's wish decides which world this session is in.
  const prevSpawn = game.spawnPose, prevStart = game.onfoot.sessionStart.bind(game.onfoot), prevArena = game.arena.start;
  game.spawnPose = () => { const id = peekRoam(); if (isBigMap(id) && !active) enter(id); return active ? spawnPose() : prevSpawn(); };
  game.arena.start = (...a) => { takeRoam(); leave(); return prevArena(...a); };
  game.onfoot.sessionStart = () => {
    const id = takeRoam();
    if (isBigMap(id)) { enter(id); if (!inMap(game.player.pos.x, game.player.pos.z)) game.respawnPlayer(spotPose("waste")); game.startIntro(false); holdHere(); }
    else if (leave()) game.startIntro(game.introT > 0);
    return prevStart();
  };
  const demoStart = game.demo.start.bind(game.demo); // the demo reel and the title's attract mode play in the Saltreach
  game.demo.start = (o) => { leave(); return demoStart(o); };

  const api = {
    get active() { return !!active; },
    enter, leave, teleport,
    bounds: { x0: ASH.site.x - ASH.half + 10, x1: ASH.site.x + ASH.half - 10, z0: ASH.site.z - ASH.half + 10, z1: ASH.site.z + ASH.half - 10 },
    placeName: () => (sites && sites.nameAt(game.player.pos.x, game.player.pos.z)) || BIOME_NAME[biomeAt(game.player.pos.x, game.player.pos.z)],
    sites: () => (sites ? sites.stats() : null),
    roads: () => (roads ? roads.stats() : null),
    ready: () => !!active && !hold,
    resetMax() { ms.max = 0; rescues = 0; },
    state() {
      const p = game.player, s = stream ? stream.stats() : { tiles: 0, byLod: [0, 0, 0], pending: 0, colliders: 0 };
      const mem = typeof performance !== "undefined" && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      return {
        active: !!active, map: active, sizeKm: ASH.size / 1000, biome: active ? biomeAt(p.pos.x, p.pos.z) : null,
        tile: [tileI(p.pos.x), tileJ(p.pos.z)], pos: { x: Math.round(toMapX(p.pos.x)), y: +p.pos.y.toFixed(1), z: Math.round(toMapZ(p.pos.z)) },
        tilesLoaded: s.tiles, byDetail: s.byLod, pending: s.pending, collidersLive: s.colliders,
        buildMs: { last: +ms.last.toFixed(2), max: +ms.max.toFixed(2), budget: BUDGET_MS },
        drawCalls: game.rend.stats.calls, ktris: Math.round(game.rend.stats.tris / 1000), frameMs: +game.loop.frameMs.toFixed(1),
        heapMB: mem, materials: gfx ? gfx.stats().materials : 0, rescues, held: !!hold,
      };
    },
    // Before physics: a freshly placed car waits (at most 4 s) until the collider tiles under it are live.
    control(dt) {
      if (!active || !hold) return;
      const p = game.player;
      holdT += dt;
      if ((stream.readyAround(p.pos.x, p.pos.z) && !sites.busy()) || holdT > 4) { hold = null; return; }
      p.pos.set(hold.x, hold.y, hold.z); p.quat.copy(hold.q); p.vel.set(0, 0, 0); p.angVel.set(0, 0, 0);
      p.prevPos.copy(p.pos); p.prevQuat.copy(p.quat);
      Object.assign(p.ctl, { throttle: 0, brake: 1, steer: 0, handbrake: true, turbo: false });
    },
    step(dt) {
      if (!active) return;
      edge.step(dt);
      // Safety net: a local car that ends up under the ground is put back on it (counted; should stay 0).
      for (const v of game.vehicles) {
        if (v.remote || v.air || !inMap(v.pos.x, v.pos.z)) continue;
        const g = heightAt(v.pos.x, v.pos.z);
        if (v.pos.y < g - 3) { v.pos.y = g + 1.5; if (v.vel.y < 0) v.vel.y = 0; rescues++; }
      }
    },
    frame(dt, real) {
      if (!active) return;
      const t0 = now(), cam = game.camera;
      if (cam.far !== FAR) { cam.far = FAR; cam.updateProjectionMatrix(); }
      updT -= real;
      if (updT <= 0) {
        updT = 0.2;
        const list = [];
        for (const v of game.vehicles) {
          if (v.remote || !inMap(v.pos.x, v.pos.z)) continue;
          list.push({ x: v.pos.x, z: v.pos.z, wide: (!!v.air || v.airTime > 0.3) && Math.hypot(v.vel.x, v.vel.z) > 45 });
        }
        stream.setScale(Math.min(1.25, Math.max(0.7, game.rend.q.lod / 0.8)));
        stream.update(cam.position.x, cam.position.z, list);
        roads.update(cam.position.x, cam.position.z);
        sites.update([{ x: cam.position.x, z: cam.position.z }, ...list]);
      }
      stream.pump(BUDGET_MS);
      ms.last = now() - t0;
      if (ms.last > ms.max) ms.max = ms.last;
    },
    dispose() { leave(false); if (roads) { roads.dispose(); sites.dispose(); } if (gfx) gfx.dispose(); gfx = null; },
  };
  return api;
}