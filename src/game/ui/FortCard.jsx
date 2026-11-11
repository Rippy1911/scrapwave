import { Skull } from "lucide-react";

// Near a raider fortress: its name, core health, walls still standing and guards, or the rebuild timer.
export default function FortCard({ fort }) {
  if (!fort) return null;
  const fallen = fort.state === "fallen";
  return (
    <div className="fixed right-3 top-40 w-[200px] sw-panel px-3 py-2 sw-slide">
      <div className="flex items-center gap-2">
        <Skull className="h-4 w-4 text-[#ff5a3a]" />
        <span className="sw-display truncate text-sm tracking-wider text-[#ff8a6a]">{fort.name}</span>
      </div>
      {fallen ? (
        <div className="mt-1 text-[11px] uppercase tracking-wider text-[#a8987f]">Fallen · rebuilds in {Math.floor(fort.rebuild / 60)}:{String(fort.rebuild % 60).padStart(2, "0")}</div>
      ) : (
        <>
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-[#e9dcc4]"><span>Core</span><b>{Math.round(fort.core * 100)}%</b></div>
          <div className="h-2 overflow-hidden rounded-sm border border-[#46413a] bg-[#11100f]"><div className="h-full bg-[#ff5a3a]" style={{ width: `${fort.core * 100}%` }} /></div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-[#a8987f]">{fort.walls} walls · {fort.guards} guards · wreck the core</div>
        </>
      )}
    </div>
  );
}