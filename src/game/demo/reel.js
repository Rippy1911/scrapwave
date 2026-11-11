// Demo reel: an autopilot show reel filmed by the director. Seven scenes: three new ones first (Take flight,
// Hunt, Build your base: scripted in demo/scene*.js) and then the four car set-ups (bridge gap, Rattler fight,
// turbo ramps, refinery blast). Also the title attract mode. Progress made during it is discarded on stop.
// ?demo=fly | hunt | base plays just that scene (demo/urlScene.js).
import * as THREE from "three";
import { TEST_START } from "@/game/data/places";
import { poseAt, roadSpawn, nearestRoadPose } from "@/game/world/spawn";
import { createDirector } from "@/game/demo/director";
import { seedRandom } from "@/game/game/modes";
import { getRules, setRules } from "@/game/rules/state";
import { urlScene } from "@/game/demo/urlScene";
import { fly } from "@/game/demo/sceneFly";
import { hunt } from "@/game/demo/sceneHunt";
import { build } from "@/game/demo/sceneBase";

const fwd = new THREE.Vector3();

// n Rattlers on the road `dist` metres ahead of the player (skipped if a fight is already nearby).
function spawnAhead(game, n, dist) {
  const p = game.player;
  if (game.vehicles.filter((v) => v.alive && v.team === "rattler" && v.pos.distanceTo(p.pos) < 200).length >= n) return;
  fwd.set(0, 0, -1).applyQuaternion(p.quat);
  for (let i = 0; i < n; i++) {
    const pose = nearestRoadPose(game.world, p.pos.x + fwd.x * (dist + i * 14), p.pos.z + fwd.z * (dist + i * 14), -fwd.x, -fwd.z, game.vehicles);
    game.ai.makeRattler(pose, null, i === 0 ? "pickup" : "buggy");
  }
}
const others = (game) => game.vehicles.filter((v) => v !== game.player);

// A scene: { id, name, dur, seed?, setup(ctx), step?(ctx, dt, t), drive?(ctx, dt, t), end?(ctx), info?(ctx) }.
// drive replaces the autopilot for the player (the aircraft, the horde hunter); the car set-ups leave it to the autopilot.
const SEGMENTS = [
  fly, hunt, build,
  { id: "bridge", name: "Bridge gap", dur: 26, setup: ({ game: g }) => g.respawnPlayer(poseAt(g.world, TEST_START.x, TEST_START.z, TEST_START.heading)) },
  { id: "rattler", name: "Rattler fight", dur: 34, setup: ({ game: g }) => spawnAhead(g, 3, 110) },
  { id: "turbo", name: "Turbo jumps", dur: 28, setup: ({ game: g }) => g.respawnPlayer(roadSpawn(g.world, { road: "highway", s: 150, dir: 1 }, others(g))) },
  { id: "refinery", name: "Refinery blast", dur: 32, setup: ({ game: g }) => { g.respawnPlayer(nearestRoadPose(g.world, -430, 38, -1, 0, others(g))); spawnAhead(g, 2, 70); } },
];

export function createDemo(game, modes) {
  const dir = createDirector(game);
  const D = { running: false, attract: false, t: 0, seg: 0, segT: 0, plays: 0, done: [] };
  let snapshot = null, rules = null, list = SEGMENTS, restoreRng = null, scene = null;
  const ctx = { game, dir, D, data: {} };

  // The autopilot slot belongs to the scene while it has a pilot of its own.
  const ap = game.autopilotCtl, apStep = ap.step;
  ap.step = (dt) => { if (D.running && scene && scene.drive) scene.drive(ctx, dt, D.segT); else apStep(dt); };

  function endScene() {
    if (scene && scene.end) scene.end(ctx);
    scene = null; ctx.data = {};
    if (restoreRng) { restoreRng(); restoreRng = null; } // Math.random back to what it was
    if (game.arena.active) game.arena.leave();
  }

  function begin(i, guard = 0) {
    endScene();
    D.seg = i; D.segT = 0;
    scene = list[i];
    // Fixed seed per scene (not under ?test=1, which seeds the whole page): the same spawns, rolls and raid every play.
    if (scene.seed && !modes.test) restoreRng = seedRandom(scene.seed);
    ctx.data = {};
    if (scene.setup(ctx) === false && guard < list.length) { D.done.push(`${scene.id}:skipped`); begin((i + 1) % list.length, guard + 1); return; }
    const p = game.player;
    p.turbo = 1; p.fuel = p.fuelMax;
    game.introT = 0;
    game.cam.snap(p);
    dir.reset();
  }

  D.start = ({ attract = false } = {}) => {
    D.attract = attract;
    if (D.running) return;
    const only = urlScene();
    list = only ? SEGMENTS.filter((s) => s.id === only) : SEGMENTS;
    D.running = true; game.attract = true;
    snapshot = JSON.stringify(game.save); game.noSave = true;
    rules = getRules();
    game.replay.stop();
    game.autopilotCtl.set(true);
    D.t = 0; D.plays = 0; D.done = [];
    begin(0);
  };
  D.stop = () => {
    if (!D.running) return;
    endScene();
    D.running = false; game.attract = false;
    if (!modes.autoplay && !modes.test) game.autopilotCtl.set(false);
    game.noSave = !!(modes.autoplay || modes.test);
    if (snapshot) {
      // Settings changed during the reel (quality, volume) are kept; gameplay progress is discarded.
      const keep = { quality: game.save.quality, qualityChosen: game.save.qualityChosen, volume: game.save.volume };
      const s = JSON.parse(snapshot); for (const k of Object.keys(s)) game.save[k] = s[k];
      Object.assign(game.save, keep);
      snapshot = null;
    }
    if (rules) { setRules(rules); rules = null; }
    dir.reset();
    game.cam.snap(game.player);
  };
  // Sim step: the scene's script, then segment timing (loops after the last scene).
  D.step = (dt) => {
    if (!D.running) return;
    D.t += dt; D.segT += dt;
    if (scene.step) scene.step(ctx, dt, D.segT);
    if (D.segT < scene.dur) return;
    D.plays++; D.done.push(scene.id);
    const next = (D.seg + 1) % list.length;
    if (next === 0) D.t = 0;
    begin(next);
  };
  // Render frame: the director owns the camera while the reel runs.
  D.update = (real) => { if (!D.running) return false; dir.update(real); return true; };
  D.state = () => ({
    running: D.running, shot: dir.kind(), t: Math.round(D.t * 10) / 10, segment: list[D.seg].name, scene: list[D.seg].id,
    sceneT: Math.round(D.segT * 10) / 10, plays: D.plays, done: D.done.slice(-12), attract: D.attract,
    length: Math.round(list.reduce((n, s) => n + s.dur, 0)), info: D.running && scene && scene.info ? scene.info(ctx) : null,
  });
  return D;
}
