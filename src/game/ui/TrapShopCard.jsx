// Trap upgrade offer, shown while the car sits at an outpost (Well-town or a fuel station) and a tier is left.
export default function TrapShopCard({ traps }) {
  const o = traps && traps.shop;
  if (!o) return null;
  const status = o.locked ? `Finish ${o.need} jobs & contracts (${o.have}/${o.need})` : o.afford ? "Press U to buy" : `Needs ${o.price} banked scrap`;
  return (
    <div className="sw-hud-trapshop absolute left-4 top-[150px] w-60 sw-panel sw-slide px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#c9a36a]">Trap upgrade</div>
      <div className="mt-0.5 flex items-baseline justify-between">
        <span className="sw-display text-base text-[#f4ead6]">{o.name}</span>
        <span className="text-sm font-semibold text-[#f2c230]">{o.price}</span>
      </div>
      <div className="text-[11px] text-[#a8987f]">Bigger slicks · meaner spikes · harder mines · +1 charge</div>
      <div className={`mt-1 text-[11px] uppercase tracking-[0.2em] ${!o.locked && o.afford ? "text-[#f2c230] sw-pulse" : "text-[#ff8a6a]"}`}>{status}</div>
    </div>
  );
}