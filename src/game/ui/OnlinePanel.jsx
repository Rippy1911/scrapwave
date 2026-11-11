import { useEffect, useState } from "react";
import { fetchJson } from "@/game/net/net";

// Title-screen panel: players online, shards and the weekly ladder top 10. Refreshes every 30 s while
// mounted; stays hidden when the server does not answer.
export default function OnlinePanel() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [shards, ladder] = await Promise.all([fetchJson("/shards"), fetchJson("/ladder")]);
        if (live) setData({ shards: Array.isArray(shards) ? shards : [], ladder: ladder || {} });
      } catch {
        if (live) setData(null);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { live = false; clearInterval(id); };
  }, []);
  if (!data) return null;
  const humans = data.shards.reduce((n, s) => n + (s.humanCount || 0), 0);
  const top = (data.ladder.top || []).slice(0, 10);
  return (
    <div className="absolute right-4 top-4 hidden w-64 sw-panel p-4 text-xs sw-slide lg:block">
      <div className="flex items-baseline justify-between">
        <span className="sw-display text-sm tracking-wider text-[#f2c230]">Online</span>
        <span className="uppercase tracking-[0.2em] text-[#7fe0a0]">{humans} driving</span>
      </div>
      <div className="mt-2 space-y-0.5">
        {data.shards.map((s) => (
          <div key={s.id} className="flex justify-between text-[#d8cbb2]">
            <span>{s.id}</span><span className="text-[#a8987f]">{s.humanCount}/{s.maxHumans} · {s.phase}</span>
          </div>
        ))}
      </div>
      {top.length > 0 && (
        <>
          <div className="mt-3 border-t border-[#46413a] pt-2 uppercase tracking-[0.2em] text-[#a8987f]">Weekly ladder{data.ladder.week ? ` · ${data.ladder.week}` : ""}</div>
          <ol className="mt-1 space-y-0.5">
            {top.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex justify-between text-[#d8cbb2]">
                <span><span className="inline-block w-5 text-[#8a7d6a]">{i + 1}.</span>{r.name}</span>
                <span className="text-[#f2c230]">{r.bestScrap}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}