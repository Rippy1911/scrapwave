import { useEffect, useState } from "react";
import { runRaceCheck } from "@/game/maps/race/raceCheck";

// ?racecheck=1: the race tracks' numbers on screen (and in the console).
export default function RaceCheckCard() {
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(runRaceCheck()); }, []);
  if (!rows) return null;
  return (
    <div className="pointer-events-none fixed left-3 top-1/2 z-[60] sw-panel px-4 py-3 sw-body text-sm text-[#efe3cb]">
      <div className="sw-display mb-1 text-base text-[#f2c230]">RACE CHECK</div>
      <table className="tabular-nums">
        <thead><tr className="text-left text-xs uppercase tracking-[0.15em] text-[#a8987f]"><th className="pr-4">Track</th><th className="pr-4">Lap</th><th className="pr-4">Checkpoints</th><th className="pr-4">AI lap</th><th className="pr-4">Jumps</th><th>Check</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.track}>
              <td className="pr-4">{r.track}</td><td className="pr-4">{r.lapMetres} m</td><td className="pr-4">{r.checkpoints}</td><td className="pr-4">{r.aiLap}</td><td className="pr-4">{r.jumps}</td>
              <td className={r.ok ? "text-[#7fe0a0]" : "text-[#ff8a6a]"}>{r.ok ? "OK" : "CHECK"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 text-xs text-[#a8987f]">AI lap: the race AI on the lap model, not a car in the physics.</div>
    </div>
  );
}