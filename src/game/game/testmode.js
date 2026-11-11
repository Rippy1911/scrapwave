// ?test=1 scripted scenario and ?accel=1 speed check. Both report into game.testReport / game.accelReport,
// which the ?debug=1 overlay and window.scrapwake.state() expose.
import { TEST_START } from "@/game/data/places";
import { poseAt, surfaceY } from "@/game/world/spawn";

function highwayGap(roads) {
  const S = roads.roads.find((r) => r.id === "highway").samples;
  let iB = 0;
  for (let i = 0; i < S.length; i++) if (S[i].deck) iB = i;
  return { S, iB };
}

// Fuel barrel stack beside the landing (added before props are finalized).
export function testProps(roads) {
  const { S, iB } = highwayGap(roads);
  const p = S[Math.min(S.length - 1, iB + 4)], out = [];
  const bx = p.x + p.dz * 10, bz = p.z - p.dx * 10;
  for (let i = 0; i < 6; i++) out.push({ kind: "barrel", x: bx + (i % 3) * 1.1 * p.dx, z: bz + (i % 3) * 1.1 * p.dz + Math.floor(i / 3) * 1.1 });
  return out;
}

export function setupTest(game) {
  const w = game.world;
  game.respawnPlayer(poseAt(w, TEST_START.x, TEST_START.z, TEST_START.heading));
  game.player.turbo = 1;
  const { S, iB } = highwayGap(w.roads);
  const s = S[Math.min(S.length - 1, iB + 9)];
  const buggy = game.ai.makeRattler({ x: s.x, y: surfaceY(w, s.x, s.z), z: s.z, heading: Math.atan2(s.dx, s.dz) }, null, "buggy");
  buggy.brain.mode = "wait";
  buggy.skillName = "rookie";
  game.autopilotCtl.set(true);
  const r = game.testReport = { t: 0, jumped: false, bestAir: 0, partOff: false, wrecked: false, pass: false, fail: false, at: 0, buggy };
  const prevPart = game.onPartOff;
  game.onPartOff = (v, part) => { if (v === buggy) r.partOff = true; prevPart(v, part); };
}

export function testStep(game, dt) {
  const r = game.testReport;
  if (!r || r.pass || r.fail) return;
  const p = game.player;
  r.t += dt;
  r.bestAir = Math.max(r.bestAir, p.airTime);
  if (p.airTime > 1) r.jumped = true;
  if (!r.buggy.alive && r.buggy.lastHitBy === p) r.wrecked = true;
  if (r.jumped && r.partOff && r.wrecked) { r.pass = true; r.at = r.t; game.callout("TEST PASSED", `${r.t.toFixed(1)} s`, "#7fe0a0"); }
  else if (r.t > 30) { r.fail = true; game.callout("TEST FAILED", "see debug overlay", "#ff4a2a"); }
}

// ?accel=1: run 1 holds W for 3 s from the spawn; run 2 respawns and holds W+Shift for 6 s.
export function setupAccel(game) {
  game.accelReport = { run: 1, t: 0, v3: 0, t120: null, v6: 0, done: false };
}

export function accelStep(game, dt) {
  const a = game.accelReport;
  if (!a || a.done) return false;
  const p = game.player;
  if (game.introT > 0) return true;
  a.t += dt;
  const kmh = p.vel.length() * 3.6;
  Object.assign(p.ctl, { throttle: 1, brake: 0, steer: 0, handbrake: false, pitch: 0, turbo: a.run === 2, fire: false, rockets: false, harpoon: false });
  if (a.run === 1 && a.t >= 3) { a.v3 = Math.round(kmh); a.run = 2; a.t = 0; game.respawnPlayer(); p.turbo = 1; game.player.turbo = 1; }
  else if (a.run === 2) {
    if (a.t120 === null && kmh >= 120) a.t120 = Math.round(a.t * 100) / 100;
    if (a.t >= 6) { a.v6 = Math.round(kmh); a.done = true; a.pass = a.v3 >= 60 && a.t120 !== null; }
  }
  return true;
}