// Trader services: restock traps / patch tyres, and the next trap tier at this faction's price.
export default function TraderServices({ view, onService }) {
  if (!view.canTrade) return null;
  const t = view.trap;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#3a362f] pt-3">
      <button onClick={() => onService("restock")} className="sw-btn px-3 py-1 text-xs">{view.tyres ? "Patch tyres" : "Restock traps"}</button>
      {t && (
        <button disabled={t.locked || !t.afford} onClick={() => onService("trap")} className="sw-btn px-3 py-1 text-xs disabled:opacity-30">
          {t.name} traps · {t.price}{t.locked ? ` · ${t.have}/${t.need} jobs` : ""}
        </button>
      )}
      {view.need && <span className="text-xs text-[#a8987f]">This cycle they need: <span className="text-[#9be36a]">{view.need}</span></span>}
    </div>
  );
}