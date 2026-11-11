// ?aicheck=1 (AI avoidance): 12 AI cars on every non-race map for 60 s each, then a table per map of wall hits,
// stuck events and respawns. Maps: Free Roam plus every arena/stunt map in maps/catalog.js (the legacy arenas too).
// Options: &secs=60 &cars=12 &maps=quarry,yard (ids) &avoid=0 (the old driving, for the "before" run).
// The cars fight each other with their weapons held and cannot be wrecked, the player sits parked, so the numbers
// are about driving. Definitions (all measured here, not by the AI code):
//   wall hit   = the game's own impact event against anything that is not a car (v.impacts: >= 7 m/s into it)
//   stuck      = the car wants to move (throttle or brake held) but stays slower than 1.5 m/s forward and within
//                10 m of where it stopped, with no other car within 7 m; counted at 2 s, "long" at 5.25 s (the AI
//                backs out at 2 s and respawns itself at 5 s); an episode ends once it is above 3 m/s forward again
//   respawn    = a jump of more than 6 m in one step (the AI's own safe-point respawn or the old road reset)
// The report is in game.aiReport, window.scrapwake.aicheck() and the console ([aicheck] lines).
import * as THREE from "three";
import { WORLD } from "@/game/data/tuning";
import { mulberry32 } from "@/game/core/rng";
import { setRules } from "@/game/rules/state";
import { DEFAULT_RULES } from "@/game/rules/gameRules";
import { clearAI } from "@/game/rules/population";
import { allMaps } from "@/game/maps/catalog";
import { clearAt, surfaceY } from "@/game/world/spawn";
import { avoidOn, avoidStats } from "@/game/ai/avoid";

const AI_TEAMS = new Set(["rattler", "drifter"]);
const fwd = new THREE.Vector3();

export function setupAiCheck(game) {
  const q = new URLSearchParams(window.location.search);
  const only = (q.get("maps") || "").split(",").filter(Boolean);
  const list = allMaps().filter((m) => m.kind !== "race" && !m.own && !m.online && (!only.length || only.includes(m.id)));
  game.noSave = true;
  game.aiReport = { done: false, avoid: avoidOn(), secs: +q.get("secs") || 60, cars: +q.get("cars") || 12, maps: [], table: "" };
  game.aiCheck = { list, i: -1, stage: "next", t0: 0, row: null, cars: new Set(), rng: null };
  console.info(`[aicheck] ${list.length} maps: ${list.map((m) => m.id).join(", ")} · avoidance ${avoidOn() ? "ON" : "OFF"}`);
}

// ---- spawning ------------------------------------------------------------------------------------------------
function roamPose(game, rng, onRoad) {
  const W = game.world, roads = W.roads.roads, lim = WORLD.bound - 90;
  for (let i = 0; i < 300; i++) {
    let x, z, h;
    if (onRoad) {
      const r = roads[Math.floor(rng() * roads.length)], s = r.samples[Math.floor(rng() * r.samples.length)];
      if (s.deck || s.bridge) continue;
      const sg = rng() < 0.5 ? 1 : -1;
      x = s.x; z = s.z; h = Math.atan2(-s.dx * sg, -s.dz * sg);
    } else {
      x = (rng() * 2 - 1) * lim; z = (rng() * 2 - 1) * lim; h = rng() * Math.PI * 2;
      if (W.roads.nearest(x, z, 1, false).dist < 30 || Math.abs(W.terrain.heightAt(x + 5, z) - W.terrain.heightAt(x - 5, z)) > 3) continue;
    }
    if (game.inTown(x, z) || Math.hypot(x - game.player.pos.x, z - game.player.pos.z) < 60 || !clearAt(W, x, z, 7, game.vehicles)) continue;
    return { x, y: surfaceY(W, x, z), z, heading: h };
  }
  return null;
}

function startMap(game, S, m) {
  const R = game.aiReport, A = game.arena, n = R.cars, rng = mulberry32(4242 + S.i * 101);
  Math.random = mulberry32(777 + S.i * 13); // the same placements and dice in the before and after runs
  if (A.active) A.leave();
  clearAI(game);
  S.cars.clear();
  if (m.kind === "roam") {
    game.respawnPlayer();
    for (let i = 0; i < n; i++) {
      const pose = roamPose(game, rng, i < n - 4);
      if (!pose) continue;
      if (i % 2) game.ai.makeRattler(pose, null, i % 4 === 1 ? "pickup" : "buggy");
      else { const e = game.drifters.roster[(i / 2) | 0]; if (e && !e.v) game.drifters.spawnOne(e, pose); }
    }
  } else {
    A.start(setRules({ ...DEFAULT_RULES, name: "AI check", mode: "arena", map: m.id, aiCount: 0, win: "any", horde: "off", timeLimit: 600, powerups: false, fuel: false, building: false, raids: false }));
    const mp = A.map, sp = mp.spawns, c = mp.ctx.site;
    const pose = (i) => { // a spawn point each, the extra cars 8 m inward of the first ones
      const s = sp[i % sp.length], dx = c.x - s.x, dz = c.z - s.z, d = Math.hypot(dx, dz) || 1, k = Math.floor(i / sp.length) * 8;
      return { x: s.x + (dx / d) * k, y: s.y, z: s.z + (dz / d) * k, heading: Math.atan2(-dx, -dz) };
    };
    A.opponents.start(n, { pose, skill: 0.5, site: c, R: mp.ctx.R, floorY: mp.ctx.floorY, race: null });
  }
  game.player.god = true;
  S.row = { id: m.id, name: m.name, kind: m.kind, cars: 0, carSec: 0, hits: 0, stuck: 0, long: 0, maxStuck: 0, respawns: 0, ownRespawns: 0, wrecks: 0 };
  S.t0 = game.time;
  S.stage = "run";
  console.info(`[aicheck] ${m.id}: running ${R.secs} s`);
}

// ---- measuring -----------------------------------------------------------------------------------------------
function watch(game, S, v, dt) {
  const ac = v._ac || (v._ac = { map: S.i, px: v.pos.x, pz: v.pos.z, hits0: v.impacts || 0, ev: 0, ep: false, epT: 0, epX: 0, epZ: 0, f2: false, f5: false, idle: 0, dead: false });
  if (ac.map !== S.i) return;
  const row = S.row, c = v.ctl;
  if (!S.cars.has(v)) { S.cars.add(v); row.cars++; v.god = true; }
  if (!v.alive) { if (!ac.dead) { ac.dead = true; row.wrecks++; row.hits += (v.impacts || 0) - ac.hits0; ac.hits0 = v.impacts || 0; } return; }
  c.fire = false; c.rockets = false; c.harpoon = false; // driving only
  row.carSec += dt;
  const moved = Math.hypot(v.pos.x - ac.px, v.pos.z - ac.pz);
  ac.px = v.pos.x; ac.pz = v.pos.z;
  if (moved > 6) { row.respawns++; ac.ep = false; ac.epT = 0; return; }
  fwd.set(0, 0, -1).applyQuaternion(v.quat);
  let crowd = false; // another car within 7 m: a ram or a pile-up (cars cannot be wrecked here), not scenery
  for (const o of game.vehicles) if (o !== v && o.alive && Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z) < 7 && Math.abs(o.pos.y - v.pos.y) < 4) { crowd = true; break; }
  const fs = v.vel.x * fwd.x + v.vel.z * fwd.z, trying = (c.throttle > 0.3 || c.brake > 0.5) && !crowd && !game.inTown(v.pos.x, v.pos.z) && v.contacts >= 2;
  if (!ac.ep) {
    if (trying && fs < 1.5) { ac.ep = true; ac.epT = 0; ac.epX = v.pos.x; ac.epZ = v.pos.z; ac.f2 = ac.f5 = false; }
  } else {
    ac.epT += dt;
    if (ac.epT >= 2 && !ac.f2) { ac.f2 = true; row.stuck++; }
    if (ac.epT >= 5.25 && !ac.f5) {
      ac.f5 = true; row.long++;
      const A = v.brain.av, b = v.brain, s = game.arena.active ? game.arena.map.ctx.site : { x: 0, z: 0 };
      if (row.long <= 6) console.info(`[aicheck] long-stuck ${row.id} ${v.name} t=${(game.time - S.t0).toFixed(1)} rel=(${(v.pos.x - s.x).toFixed(0)},${(v.pos.z - s.z).toFixed(0)}) y=${v.pos.y.toFixed(1)} mode=${b.mode} tgt=${b.target ? b.target.name : "-"} thr=${c.throttle.toFixed(1)} brk=${c.brake.toFixed(1)} st=${c.steer.toFixed(1)} rev=${(b.reverse || 0).toFixed(1)} av=${A ? JSON.stringify({ pT: +A.pT.toFixed(1), free: +A.free.toFixed(1), fwd: +A.fwdFree.toFixed(1), pick: A.pick, d: Array.from(A.d).map((x) => Math.round(x)), resp: A.resp, fail: A.fail, crowd: A.crowd, ev: A.stuckEv }) : "none"} contacts=${v.contacts} speed=${v.vel.length().toFixed(1)}`);
    }
    row.maxStuck = Math.max(row.maxStuck, ac.epT);
    if (Math.hypot(v.pos.x - ac.epX, v.pos.z - ac.epZ) > 10 || fs > 3 || (!trying && (ac.idle += dt) > 1)) { ac.ep = false; ac.idle = 0; } // moved on, got going again, or stopped wanting to
    if (trying) ac.idle = 0;
  }
}

function closeMap(game, S) {
  const row = S.row;
  for (const v of S.cars) {
    if (v.alive) { row.hits += (v.impacts || 0) - v._ac.hits0; const st = avoidStats(v); if (st) row.ownRespawns += st.respawns; }
  }
  row.hitsPerCarMin = row.carSec ? +(row.hits / (row.carSec / 60)).toFixed(2) : 0;
  row.maxStuck = +row.maxStuck.toFixed(1);
  row.carSec = Math.round(row.carSec);
  game.aiReport.maps.push(row);
  console.info(`[aicheck] ${row.id}: ${JSON.stringify(row)}`);
}

function finish(game, S) {
  const R = game.aiReport;
  const head = "| map | cars | car-min | wall hits | hits/car/min | stuck >=2 s | stuck >5 s | longest stuck (s) | respawns | wrecks |\n|---|---|---|---|---|---|---|---|---|---|";
  const rows = R.maps.map((r) => `| ${r.name} | ${r.cars} | ${(r.carSec / 60).toFixed(1)} | ${r.hits} | ${r.hitsPerCarMin} | ${r.stuck} | ${r.long} | ${r.maxStuck} | ${r.respawns} | ${r.wrecks} |`);
  R.table = `avoidance ${R.avoid ? "ON" : "OFF"}, ${R.cars} cars x ${R.secs} s per map\n${head}\n${rows.join("\n")}`;
  R.done = true; S.stage = "done";
  if (A_OK(game)) game.arena.leave();
  console.info(`[aicheck] done\n${R.table}`);
  game.callout("AI CHECK DONE", `${R.maps.reduce((a, r) => a + r.hits, 0)} hits · ${R.maps.reduce((a, r) => a + r.stuck, 0)} stuck`, "#8fd36b");
}
const A_OK = (game) => game.arena && game.arena.active;

// Each fixed step, after the AI drivers (round15.js control layer).
export function aiCheckStep(game, dt) {
  const S = game.aiCheck;
  if (!S || S.stage === "done" || game.introT > 0) return;
  // Runs from the title screen's attract reel (no menu click, so the menus and GameRoot stay untouched): stop the
  // reel and its autopilot, the player is a parked bystander.
  if (game.demo && game.demo.running) { game.demo.stop(); game.noSave = true; }
  if (typeof window !== "undefined" && window.scrapwake && !window.scrapwake.aicheck) window.scrapwake.aicheck = () => game.aiReport;
  if (S.stage === "next") {
    if (++S.i >= S.list.length) return finish(game, S);
    return startMap(game, S, S.list[S.i]);
  }
  for (const v of game.vehicles) if (v !== game.player && v.brain && !v.remote && AI_TEAMS.has(v.team)) watch(game, S, v, dt);
  if (game.time - S.t0 >= game.aiReport.secs) { closeMap(game, S); S.stage = "next"; }
}
