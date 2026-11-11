import { Lock } from "lucide-react";

const PHASE = { lobby: "Open", match: "Playing", results: "Results" };
const pingColor = (ms) => (ms < 90 ? "text-[#7fe0a0]" : ms < 180 ? "text-[#f2c230]" : "text-[#ff8a6a]");

// One open lobby in the list: tap to join (a locked one asks for its code).
export default function LobbyRow({ b, onJoin }) {
  const full = b.players >= b.max;
  return (
    <button disabled={b.mine || full} onClick={() => onJoin(b)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-3 border-t border-[#3a362f] px-2 py-2.5 text-left transition-colors hover:bg-[#25211c] disabled:opacity-60 sm:grid-cols-[1.6fr_1fr_1fr_auto_auto]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 sw-display text-sm text-[#eadfc8] group-hover:text-[#f2c230]">
          {b.locked && <Lock className="h-3 w-3 shrink-0 text-[#a8987f]" />}<span className="truncate">{b.name}</span>
        </div>
        <div className="text-[11px] text-[#7d7262]">{b.mine ? "Your lobby" : `Host ${b.host}`} · {PHASE[b.phase] || b.phase}</div>
      </div>
      <div className="hidden truncate text-sm text-[#e9dcc4] sm:block">{b.mode}</div>
      <div className="hidden truncate text-sm text-[#a8987f] sm:block">{b.map}</div>
      <div className={`sw-display text-sm ${full ? "text-[#ff8a6a]" : "text-[#f4ead6]"}`}>{b.players}/{b.max}</div>
      <div className={`hidden w-14 text-right text-xs sm:block ${pingColor(b.ping)}`}>{b.ping} ms</div>
    </button>
  );
}