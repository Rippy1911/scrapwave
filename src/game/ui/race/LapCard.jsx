import { lapText } from "@/game/race/lapTimer";

// Lap clock under the lap map: lap count and place, the running lap, the last and best lap, and the gap to the best
// lap at the last checkpoint (green = ahead of it, red = behind).
export default function LapCard({ race }) {
  if (!race) return null;
  const d = race.delta;
  return (
    <div className="mt-2 w-[190px] sw-panel px-3 py-2 sw-body">
      <div className="flex items-baseline justify-between text-xs uppercase tracking-[0.2em] text-[#a8987f]">
        <span>Lap <span className="text-[#efe3cb]">{race.lap}/{race.laps}</span></span>
        {race.field > 1 && <span>P<span className="text-[#efe3cb]">{race.place}</span>/{race.field}</span>}
      </div>
      <div className="sw-display text-2xl leading-tight text-[#f2c230] tabular-nums">{race.done ? lapText(race.total) : lapText(race.lapT, false)}</div>
      {d != null && <div className={`text-sm font-bold tabular-nums ${d <= 0 ? "text-[#7fe0a0]" : "text-[#ff8a6a]"}`}>{d <= 0 ? "-" : "+"}{Math.abs(d).toFixed(2)}</div>}
      <div className="mt-1 flex justify-between text-xs tabular-nums text-[#a8987f]">
        <span>LAST <span className="text-[#efe3cb]">{lapText(race.last)}</span></span>
      </div>
      <div className="flex justify-between text-xs tabular-nums text-[#a8987f]">
        <span>BEST <span className={race.isBest ? "text-[#7fe0a0]" : "text-[#efe3cb]"}>{lapText(race.best)}</span></span>
      </div>
      {race.wrongWay && <div className="mt-1 text-center text-xs font-bold uppercase tracking-[0.25em] text-[#ff8a6a] sw-pulse">Wrong way</div>}
    </div>
  );
}