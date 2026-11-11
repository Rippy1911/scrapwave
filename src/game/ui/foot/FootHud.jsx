import FootHealth from "@/game/ui/foot/FootHealth";
import FootSlots from "@/game/ui/foot/FootSlots";
import FootCrosshair from "@/game/ui/foot/FootCrosshair";
import ScopeOverlay from "@/game/ui/foot/ScopeOverlay";
import FootKeys from "@/game/ui/foot/FootKeys";

// Everything on screen for the walker: the scope mask, the crosshair, a red edge when hurt, the health and slots
// panel (where the car's hull panel sits while you drive), the key hints and the death card.
// foot is hud.foot (onfoot/onfoot.js); foot.combat is footCombat.js hud().
export default function FootHud({ foot, hitRecent, legendOn }) {
  const c = foot && foot.on ? foot.combat : null;
  if (!c) return null;
  const note = c.safe ? "Weapons cold" : c.reload !== null ? "Reloading" : "";
  return (
    <>
      {c.scope > 0 && <ScopeOverlay step={c.scope} />}
      <FootCrosshair c={c} hitRecent={hitRecent} />
      {c.hurt && <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(255,40,20,0.55)]" />}
      <div className="sw-hud-left absolute bottom-4 left-4 w-64 sw-panel px-4 py-3 md:w-80">
        <FootHealth c={c} />
        <div className="mt-2 flex justify-between gap-2 text-[11px] uppercase tracking-[0.18em]">
          <span className="truncate text-[#efe3cb]">{c.held || "Empty hands"}</span>
          <span className="shrink-0 text-[#ff8a6a]">{note}</span>
        </div>
        <div className="mt-1 h-1.5 bg-[#0e0c0a]">
          {c.reload !== null && <div className="h-full bg-[#f2c230]" style={{ width: `${c.reload * 100}%` }} />}
        </div>
        <FootSlots c={c} />
      </div>
      {legendOn && !c.dead && <FootKeys c={c} />}
      {c.dead && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(30,8,4,0.45)]">
          <div className="sw-display text-6xl text-[#ff4a2a] drop-shadow-[0_4px_0_#000]">KILLED</div>
          {c.cause && <div className="mt-2 sw-display text-lg tracking-widest text-[#f2e6c8]">{c.cause}</div>}
          <div className="mt-3 text-sm uppercase tracking-[0.3em] text-[#e9dcc4]">Choose your ride in {c.respawnIn}</div>
          <div className="mt-1 text-xs text-[#a8987f]">Your kit is in a bag where you fell</div>
        </div>
      )}
    </>
  );
}