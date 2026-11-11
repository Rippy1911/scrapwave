import { Radio, Timer } from "lucide-react";

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Radio job offer ("J to take it") and the active job progress cards, right side under the minimap.
export default function JobCard({ jobs }) {
  if (!jobs || (!jobs.offer && !jobs.active.length)) return null;
  return (
    <div className="sw-hud-job absolute right-4 top-[170px] md:top-[210px] flex w-64 flex-col gap-2 sw-body">
      {jobs.offer && (
        <div className="sw-panel sw-slide px-3 py-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#9cc8ff]"><Radio className="h-3 w-3" />{jobs.offer.from}</div>
          <div className="mt-1 text-sm font-bold text-[#f4ead6]">{jobs.offer.title}</div>
          <div className="mt-1 flex justify-between text-[11px] uppercase tracking-[0.2em]">
            <span className={jobs.offer.canTake ? "text-[#f2c230] sw-pulse" : "text-[#a8987f]"}>{jobs.offer.canTake ? "Press L to take it" : "Two jobs already"}</span>
            <span className="text-[#a8987f]">{jobs.offer.left}s</span>
          </div>
        </div>
      )}
      {jobs.active.map((j) => (
        <div key={j.id} className="sw-panel px-3 py-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em]">
            <span className="text-[#7fe0a0]">Job · {j.reward} scrap</span>
            <span className={`flex items-center gap-1 ${j.left < 30 ? "text-[#ff8a6a] sw-pulse" : "text-[#a8987f]"}`}><Timer className="h-3 w-3" />{fmt(j.left)}</span>
          </div>
          <div className="mt-0.5 text-sm font-bold leading-tight text-[#f4ead6]">{j.title}</div>
          {j.sub && <div className="text-[11px] uppercase tracking-[0.2em] text-[#a8987f]">{j.sub}</div>}
          <div className="mt-1.5 h-1.5 bg-[#0e0c0a]"><div className="h-full bg-[#7fe0a0] transition-all" style={{ width: `${j.k * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}