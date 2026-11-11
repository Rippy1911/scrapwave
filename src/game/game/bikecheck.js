// ?bikecheck=1 (round 15 A): every bike drives the free-roam roads, three ramps and the rough ground on its own.
// The count of falls is printed to the console, shown as a callout and kept in game.bikeReport
// (window.scrapwake.bikecheck()). Target: 0. A fall is a line in game.bikeLog, written by workshop/bike.js.
import * as THREE from "three";
import { WORLD } from "@/game/data/tuning";
import { newBrain, driveTo } from "@/game/ai/steer";
import { followRoad } from "@/game/ai/nav";
import { placeVehicle } from "@/game/vehicles/vehicle";
import { showcaseDesign } from "@/game/workshop/showcase";

const BIKES = [["dirtbike", "Dirt Bike"], ["chopper", "Chopper"], ["sidecar", "Sidecar Rig"], ["show:caltrop", "Caltrop (showcase trap bike)"]];
const ROAD_TIME = 45, RAMP_TIME = 12, ROUGH_TIME = 35;
const goal = new THREE.Vector3();
const headingOf = (dx, dz) => Math.atan2(-dx, -dz);

export function setupBikeCheck(game) {
  game.noSave = true;
  game.bikeLog = [];
  game.bikeReport = { done: false, falls: 0, bikes: [] };
  game.bikeCheck = { i: -1, stage: "next", t: 0, k: 0, mark: 0, row: null, pts: [] };
}

function mount(game, kind) {
  const pose = game.spawnPose();
  game.dropPlayer();
  const v = game.workshop.spawn(kind.startsWith("show:") ? showcaseDesign(kind) : kind, pose, { team: "player", name: "You" });
  if (!v) return null;
  game.outfitCar(v, []);
  game.adoptPlayer(v);
  v.brain = newBrain({ mode: "roam" });
  game.cam.snap(v);
  return v;
}

function put(game, v, x, z, heading) {
  placeVehicle(v, x, game.world.groundAt(x, z, 400) + 1, z, heading);
  v.bikeSt = null; v.brain.nav = null; v.brain.stuck = 0; v.brain.still = 0;
  game.cam.snap(v);
}

// The three ramps nearest the town gate, each from the start of its run-up lane.
function startRamp(game, v, s) {
  const o = game.spawnPose();
  const list = [...game.world.ramps].sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z));
  const r = list[s.k];
  if (!r) return false;
  s.ramp = r;
  const back = r.len / 2 + 40;
  put(game, v, r.x - r.dirX * back, r.z - r.dirZ * back, headingOf(r.dirX, r.dirZ));
  return true;
}

// Rough ground: a spot with no road near it, then a zig-zag of five points toward the middle of the map.
function startRough(game, v, s) {
  const lim = WORLD.size / 2 - 150;
  let at = null;
  for (const rad of [90, 150, 220, 300]) {
    for (let a = 0; a < 8 && !at; a++) {
      const x = v.pos.x + Math.cos(a * 0.785) * rad, z = v.pos.z + Math.sin(a * 0.785) * rad;
      if (Math.abs(x) < lim && Math.abs(z) < lim && !game.world.roads.nearest(x, z, 3, false).road) at = { x, z };
    }
    if (at) break;
  }
  if (!at) at = { x: v.pos.x, z: v.pos.z };
  const d = Math.hypot(at.x, at.z) || 1, fx = -at.x / d, fz = -at.z / d;
  s.pts = [0, 1, 2, 3, 4].map((k) => ({ x: at.x + fx * 60 * (k + 1) + -fz * (k % 2 ? 30 : -30), z: at.z + fz * 60 * (k + 1) + fx * (k % 2 ? 30 : -30) }));
  s.k = 0;
  put(game, v, at.x, at.z, headingOf(fx, fz));
}

function close(game, s, name) {
  s.row[name] = game.bikeLog.length - s.mark;
  s.mark = game.bikeLog.length; s.t = 0;
  game.emit({ type: "minor", text: `BIKE CHECK · ${s.row.name} · ${name}: ${s.row[name]} falls` });
}

function finish(game, s) {
  const r = game.bikeReport;
  r.done = true; s.stage = "done";
  r.falls = game.bikeLog.length; r.log = game.bikeLog.slice();
  Object.assign(game.player.ctl, { throttle: 0, brake: 1, steer: 0, handbrake: true });
  console.info(`[bikecheck] ${r.falls} falls`, JSON.stringify(r.bikes), JSON.stringify(r.log));
  game.callout(`BIKE CHECK: ${r.falls} FALLS`, r.bikes.map((b) => `${b.name} ${b.road + b.ramps + b.rough}`).join(" · "), r.falls ? "#ff8a3a" : "#8fd36b");
}

// Each fixed step, after the player's controls: the check drives instead.
export function bikeCheckStep(game, dt) {
  const s = game.bikeCheck;
  if (!s || s.stage === "done" || game.introT > 0) return;
  if (s.stage === "next") {
    if (++s.i >= BIKES.length) return finish(game, s);
    const v = mount(game, BIKES[s.i][0]);
    s.row = { name: BIKES[s.i][1], road: 0, ramps: 0, rough: 0, ok: !!v };
    game.bikeReport.bikes.push(s.row);
    s.mark = game.bikeLog.length; s.t = 0; s.stage = v ? "road" : "next";
    return;
  }
  const v = game.player;
  if (!v.alive) { s.row.wrecked = true; close(game, s, s.stage === "ramp" ? "ramps" : s.stage); s.stage = "next"; return; }
  if (v.thrown > 0) return; // down: bike.js stands it back up
  s.t += dt;
  if (s.stage === "road") {
    if (!followRoad(game, v, v.brain, goal)) { const o = game.spawnPose(); goal.set(o.x, o.y, o.z); }
    driveTo(v, goal, dt, { maxSpeed: 23, noHandbrake: true });
    if (s.t > ROAD_TIME) { close(game, s, "road"); s.k = 0; s.stage = startRamp(game, v, s) ? "ramp" : "rough"; if (s.stage === "rough") startRough(game, v, s); }
  } else if (s.stage === "ramp") {
    const r = s.ramp, along = (v.pos.x - r.x) * r.dirX + (v.pos.z - r.z) * r.dirZ;
    goal.set(r.x + r.dirX * (r.len / 2 + 80), r.y, r.z + r.dirZ * (r.len / 2 + 80));
    driveTo(v, goal, dt, { maxSpeed: 25, noHandbrake: true });
    if ((along > r.len / 2 + 40 && v.contacts >= 2) || s.t > RAMP_TIME) {
      s.t = 0; s.k++;
      if (s.k >= 3 || !startRamp(game, v, s)) { close(game, s, "ramps"); s.stage = "rough"; startRough(game, v, s); }
    }
  } else if (s.stage === "rough") {
    const p = s.pts[s.k];
    goal.set(p.x, v.pos.y, p.z);
    driveTo(v, goal, dt, { maxSpeed: 17, noHandbrake: true });
    if (Math.hypot(p.x - v.pos.x, p.z - v.pos.z) < 9) s.k++;
    if (s.k >= s.pts.length || s.t > ROUGH_TIME) { close(game, s, "rough"); s.stage = "next"; }
  }
}