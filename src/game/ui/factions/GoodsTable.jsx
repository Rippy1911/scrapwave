// Trader goods: buy what this faction sells, sell anything in the cargo hold (needed goods pay more).
export default function GoodsTable({ view, onBuy, onSell }) {
  if (!view.canTrade) return <div className="py-6 text-center text-[#ff8a6a] uppercase tracking-[0.2em] text-sm">{view.faction.name} won't trade with you</div>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs uppercase tracking-[0.18em] text-[#a8987f]">
        <span>Cargo hold {view.hold} / {view.holdMax}</span>
        <span>Banked scrap {view.banked}</span>
      </div>
      {view.goods.map((g) => (
        <div key={g.id} className="flex items-center gap-3 border-t border-[#3a362f] pt-2">
          <div className="flex-1">
            <div className="sw-display text-sm text-[#eadfc8]">{g.name}{g.needed && <span className="ml-2 text-[10px] text-[#9be36a]">NEEDED HERE</span>}</div>
            <div className="text-xs text-[#a8987f]">In hold: {g.have}</div>
          </div>
          <button disabled={g.buy == null} onClick={() => onBuy(g.id)} className="sw-btn px-3 py-1 text-xs disabled:opacity-30">{g.buy == null ? "Not sold" : `Buy ${g.buy}`}</button>
          <button disabled={!g.have} onClick={() => onSell(g.id)} className="sw-btn px-3 py-1 text-xs disabled:opacity-30">Sell {g.sell}</button>
        </div>
      ))}
    </div>
  );
}