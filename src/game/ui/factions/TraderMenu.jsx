import { useEffect, useState } from "react";
import GoodsTable from "@/game/ui/factions/GoodsTable";
import JobBoard from "@/game/ui/factions/JobBoard";
import TraderServices from "@/game/ui/factions/TraderServices";
import RepBar from "@/game/ui/factions/RepBar";

// The Trader menu (E at a trader or job board): goods, services and the faction's job board.
// Refreshes after every action and once a second (online the world keeps moving while it is open).
export default function TraderMenu({ game, postId, tab: tab0 = "trade", online, onClose }) {
  const tr = game.factions.trader;
  const [tab, setTab] = useState(tab0);
  const [view, setView] = useState(() => tr.view(postId));
  const refresh = () => setView(tr.view(postId));
  useEffect(() => { const t = setInterval(() => setView(tr.view(postId)), 1000); return () => clearInterval(t); }, [tr, postId]);
  const act = (fn) => (...a) => { fn(...a); refresh(); };
  const row = { name: view.faction.name, value: view.value, standing: view.standing };
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(10,7,5,0.7)] sw-body text-[#e9dcc4] p-4">
      <div className="sw-panel w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4 sw-slide">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="sw-display text-3xl" style={{ color: view.faction.color }}>{view.faction.name.toUpperCase()}</h2>
            {online && <div className="text-xs uppercase tracking-[0.2em] text-[#ff8a6a]">Online · the world keeps moving</div>}
          </div>
          <button onClick={onClose} className="sw-btn sw-btn-primary px-5 py-1.5 text-sm">Close</button>
        </div>
        <RepBar row={row} />
        <div className="flex gap-2">
          {["trade", "jobs"].map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`sw-btn px-4 py-1 text-xs ${tab === k ? "sw-btn-primary" : ""}`}>{k === "trade" ? "Trade" : "Job board"}</button>
          ))}
        </div>
        {tab === "trade" ? (
          <>
            <GoodsTable view={view} onBuy={act((id) => tr.buy(postId, id))} onSell={act((id) => tr.sell(postId, id))} />
            <TraderServices view={view} onService={act((w) => tr.service(postId, w))} />
          </>
        ) : <JobBoard view={view} onTake={act((k) => tr.take(postId, k))} />}
      </div>
    </div>
  );
}