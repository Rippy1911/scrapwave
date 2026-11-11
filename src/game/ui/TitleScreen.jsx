import { GAME_TITLE, VERSION } from "@/game/data/tuning";
import { net } from "@/game/net/net";
import OnlinePanel from "@/game/ui/OnlinePanel";

// Title over the live (paused) world. attract: the autopilot is playing behind the menu (after idle).
// Every button opens exactly one place (docs/menus.md): Play now, Play, Build, Settings, Demo reel.
export default function TitleScreen({ save, onPlayNow, onGo, onDemo, attract }) {
  const s = save.stats;
  const status = net.status();
  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-gradient-to-t sw-body text-[#e9dcc4] p-4 transition-colors duration-1000 ${attract ? "from-[rgba(12,8,5,0.8)] via-[rgba(20,12,8,0.15)] to-[rgba(12,8,5,0)]" : "from-[rgba(12,8,5,0.92)] via-[rgba(20,12,8,0.45)] to-[rgba(12,8,5,0.25)]"}`}>
      <OnlinePanel />
      {attract && <div className="absolute left-4 top-4 rounded-sm bg-[#5d8fd6] px-2 py-0.5 text-[11px] font-bold tracking-[0.25em] text-[#0e1420] sw-pulse">LIVE · AUTOPILOT</div>}
      <div className="w-full max-w-3xl flex flex-col items-center gap-6 sw-slide">
        <div className="text-center">
          <div className="sw-hazard h-2 w-48 mx-auto mb-4" />
          <h1 className="sw-display text-6xl md:text-8xl tracking-wider text-[#f2c230] drop-shadow-[0_5px_0_#5a1e08]">{GAME_TITLE.toUpperCase()}</h1>
          <p className="mt-2 text-sm md:text-base uppercase tracking-[0.35em] text-[#c9a36a]">Drive · Jump · Wreck · Loot the Saltreach</p>
        </div>
        <button type="button" onClick={onPlayNow} title="Online: joins an open match, or starts one and fills it with AI bots" className="sw-btn sw-btn-primary text-2xl px-14 py-4">Play now</button>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => onGo("play")} className="sw-btn px-6 py-2 text-sm">Play</button>
          <button type="button" onClick={() => onGo("workshop")} className="sw-btn px-6 py-2 text-sm" title="Cars, bikes, wings and mechs">Build</button>
          <button type="button" onClick={() => onGo("profile")} className="sw-btn px-6 py-2 text-sm">Profile</button>
          <button type="button" onClick={() => onGo("settings")} className="sw-btn px-6 py-2 text-sm">Settings</button>
          <button type="button" onClick={onDemo} className="sw-btn px-6 py-2 text-sm">Demo reel</button>
        </div>
        <div className="sw-panel w-full px-5 py-3 grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
          {[["Banked", save.banked], ["Wrecks", s.wrecks], ["Wheels off", s.wheels], ["Jumps", s.jumps], ["Best air", `${s.bestAir}s`], ["Barrels", s.barrels]].map(([k, v]) => (
            <div key={k}><div className="sw-display text-xl text-[#f2c230]">{v}</div><div className="text-[10px] uppercase tracking-[0.2em] text-[#a8987f]">{k}</div></div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#8a7d6a]">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${status.online ? "bg-[#7fe0a0]" : "bg-[#c9a36a]"}`} />
          {status.label} · v{VERSION}
        </div>
      </div>
    </div>
  );
}