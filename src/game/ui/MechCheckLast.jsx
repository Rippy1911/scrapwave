import { useEffect, useState } from "react";
import { local } from "@/game/core/safeStorage";

// ?mechcheck=1 only: the running check's list (live, from the HUD) or, before it starts, the previous run's result
// (saved when a run finishes). Right-hand column under the minimap, height-capped so it never overlaps other HUD.
export default function MechCheckLast({ live }) {
  const [last, setLast] = useState(null);
  useEffect(() => {
    try { setLast(JSON.parse(local.get("scrapwake.mechcheck") || "null")); } catch { setLast(null); }
  }, []);
  const r = live && live.items.length ? live : last;
  if (!r) return null;
  const title = r === live ? (r.done ? `Mech check: ${r.pass ? "PASS" : "FAIL"}` : `Mech check: ${r.stage}`) : `Last mech check: ${r.pass ? "PASS" : "FAIL"}`;
  return (
    <div className="pointer-events-none fixed right-4 top-56 z-50 max-h-[calc(100vh-15rem)] w-72 overflow-hidden sw-panel sw-body px-3 py-2 text-[10px] leading-tight text-[#cdbfa6]">
      <div className={!r.done && r === live ? "text-[#a8987f]" : r.pass ? "text-[#7fe0a0]" : "text-[#ff8a6a]"}>{title} · {r.items.length} checks</div>
      {r.items.map((x, i) => <div key={i} className={x.ok ? "" : "text-[#ff8a6a]"}>{x.ok ? "✓" : "✗"} {x.name}{x.note ? ` · ${x.note}` : ""}</div>)}
    </div>
  );
}