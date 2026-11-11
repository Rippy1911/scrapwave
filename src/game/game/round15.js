// Round 15: everything new plugs into the game here, so game.js only makes four calls (control, step, frame,
// dispose). Each system lives in its own folder; this file only creates them and runs them in order.
import { setupBikeCheck, bikeCheckStep } from "@/game/game/bikecheck";
import { setupTankCheck, tankCheckStep } from "@/game/game/tankcheck";
import { createMapLoader } from "@/game/maps/loader";
import { createTrackTools } from "@/game/race/trackTools";
import { raceCheckStart } from "@/game/maps/race/raceCheckStart";
import { createBigWorld } from "@/game/maps/ashmark/bigWorld";
import { createDressing } from "@/game/maps/ashmark/dressing";
import { createBigCheck } from "@/game/maps/ashmark/check";
import { attachAvoid } from "@/game/ai/attachAvoid";

export function attachRound15(game, modes = {}) {
  if (modes.bikecheck) setupBikeCheck(game);
  if (modes.tankcheck) setupTankCheck(game);
  const parts = []; // { control?, step?, frame?, dispose? } in creation order
  const add = (p) => { if (p) parts.push(p); return p; };
  game.maps = add(createMapLoader(game)); // world maps: load, unload, back to free roam where you left
  game.tracks = add(createTrackTools(game)); // race tracks: spline road, lap clock, AI race line, ghost
  add(attachAvoid(game)); // AI look-ahead, back-out and respawn (ai/avoid.js); ?aicheck=1 runs the check (game/aicheck.js)
  if (modes.racecheck && modes.track) raceCheckStart(modes.track); // ?racecheck=1&track=<id>: a one-lap race there
  game.big = add(createBigWorld(game)); // the Ashmark Expanse: a streamed 10 km free-roam map in place of the Saltreach
  add(createDressing(game)); // the Ashmark's scatter, life, garages and biome looks
  if (modes.bigcheck) add(createBigCheck(game)); // ?bigcheck=1: visits the five biomes and reports the numbers

  return {
    add,
    // After the drivers (player, AI, arena opponents), before bikes, mechs and physics read the controls.
    control(dt) {
      if (modes.bikecheck) bikeCheckStep(game, dt);
      if (modes.tankcheck) tankCheckStep(game, dt);
      for (const p of parts) if (p.control) p.control(dt);
    },
    // End of the fixed step.
    step(dt) { for (const p of parts) if (p.step) p.step(dt); },
    // Every rendered frame. dt is 0 while paused; real is wall time.
    frame(dt, real) { for (const p of parts) if (p.frame) p.frame(dt, real); },
    dispose() { for (const p of parts) if (p.dispose) p.dispose(); },
  };
}