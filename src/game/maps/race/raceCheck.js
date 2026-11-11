// ?racecheck=1: for every race world, the lap length, the checkpoint count and an AI lap time. The lap time comes
// from the lap model (race/lapSim.js): the race AI driving its line on the track's data, not a car in the physics.
import { mapsFor, layoutOf } from "@/game/maps/catalog";
import { buildTrack } from "@/game/race/track";
import { buildRaceLine } from "@/game/race/raceLine";
import { simLap } from "@/game/race/lapSim";
import { lapText } from "@/game/race/lapTimer";
import "@/game/maps/worlds";

export function runRaceCheck() {
  const rows = mapsFor("race").filter((m) => m.build).map((m) => {
    const L = layoutOf(m.id), T = buildTrack({ ...L.track, id: m.id, name: m.name }), sim = simLap(T, buildRaceLine(T));
    return {
      track: m.name, lapMetres: Math.round(T.length), checkpoints: T.checkpoints.length, aiLap: sim.lap ? lapText(sim.lap) : "did not finish",
      seconds: sim.lap ? +sim.lap.toFixed(1) : null, jumps: `${sim.landed / 2}/${T.gaps.length}`, wallTouches: sim.wallFrames, resets: sim.resets,
      ok: !!sim.lap && sim.lap >= 120 && sim.lap <= 180 && T.length >= 3000 && T.length <= 5000 && sim.landed === sim.jumps && !sim.resets,
    };
  });
  console.table(rows);
  for (const r of rows) console.log(`[racecheck] ${r.track}: lap ${r.lapMetres} m, ${r.checkpoints} checkpoints, AI lap ${r.aiLap}, jumps ${r.jumps}${r.ok ? "" : "  <-- CHECK"}`);
  return rows;
}