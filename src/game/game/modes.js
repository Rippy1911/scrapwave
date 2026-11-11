// URL modes: ?autoplay=1 (autopilot + cinematic cam), ?test=1 (fixed-seed scripted scenario),
// ?debug=1 (FPS, AI goals, collider wireframes, road graph), ?accel=1 (drive-from-spawn speed check),
// ?selfcheck=1 (fuel → pump → jerry can → replay → demo reel scripted check), ?mechcheck=1 (walker scripted check).
import { mulberry32 } from "@/game/core/rng";

export const TEST_SEED = 4242;

export function readModes() {
  const q = new URLSearchParams(window.location.search);
  const on = (k) => q.get(k) === "1" || q.get(k) === "true";
  // ?bikecheck=1 (round 15): every bike drives the roads, three ramps and rough ground; the falls are counted.
  return { autoplay: on("autoplay"), test: on("test"), debug: on("debug"), accel: on("accel"), selfcheck: on("selfcheck"), mechcheck: on("mechcheck"), bikecheck: on("bikecheck"), tankcheck: on("tankcheck"), racecheck: on("racecheck"), bigcheck: on("bigcheck"), famecheck: on("famecheck"), track: q.get("track"), quality: q.get("quality") }; // &track=<map id> with racecheck: a one-lap race there; ?quality=<preset> for this visit // ?racecheck=1: each race track's lap length, checkpoints and AI lap (maps/race/raceCheck.js)
}

// Deterministic Math.random for ?test=1. Returns a restore function.
export function seedRandom(seed = TEST_SEED) {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  return () => { Math.random = orig; };
}