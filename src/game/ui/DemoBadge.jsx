import { GAME_TITLE } from "@/game/data/tuning";

const fmt = (v) => (typeof v === "number" ? v.toLocaleString("en-US") : v);

// Corner tag while the demo reel runs from the menu (kept small so recordings stay clean). A scene may add a caption and
// a few numbers in the top-left corner (the hunt's kills and score, the base's build step and raid): hud.demo.info.
export default function DemoBadge({ hud }) {
  const d = hud && hud.demo;
  const info = d && d.info;
  return (
    <div className="pointer-events-none fixed inset-0 select-none sw-body">
      {info && (info.caption || (info.stats && info.stats.length > 0)) && (
        <div className="absolute left-5 top-5 opacity-90">
          {info.caption && <div className="sw-display text-xl tracking-wider text-[#f2c230] drop-shadow-[0_2px_0_#5a1e08]">{info.caption}</div>}
          {info.stats && info.stats.length > 0 && (
            <div className="mt-1 flex gap-5">
              {info.stats.map(([k, v]) => (
                <div key={k}>
                  <div className="text-[9px] uppercase tracking-[0.3em] text-[#efe3cb] drop-shadow-[0_1px_0_#000]">{k}</div>
                  <div className="sw-display text-2xl leading-none text-[#f4ead6] drop-shadow-[0_2px_0_#000]">{fmt(v)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="absolute right-5 bottom-5 text-right opacity-80">
        <div className="sw-display text-2xl tracking-wider text-[#f2c230] drop-shadow-[0_3px_0_#5a1e08]">{GAME_TITLE.toUpperCase()}</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#efe3cb] drop-shadow-[0_1px_0_#000]">{d ? d.segment : "Demo reel"} · Esc to exit</div>
      </div>
    </div>
  );
}
