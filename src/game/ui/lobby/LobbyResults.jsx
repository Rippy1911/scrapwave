import { Trophy } from "lucide-react";
import { WAIT_S } from "@/game/lobby/results";

const fmt = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
const cols = "grid grid-cols-[1.5rem_1fr_auto_auto_auto_auto] items-center gap-3";

// The shared results board: every player's line, ranked by the host. Host: Back to lobby. Anyone: Leave.
export default function LobbyResults({ s, L }) {
  const l = s.lobby, rows = l.results || [], closed = l.phase !== "match";
  return (
    <div className="sw-panel sw-slide flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col gap-3 px-5 py-4">
      <div className="shrink-0">
        <div className="sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#5a1e08]">ROUND {l.round} RESULTS</div>
        <div className="text-xs uppercase tracking-[0.2em] text-[#a8987f]">{l.name}{closed ? "" : ` · waiting for the others (up to ${WAIT_S} s)`}</div>
      </div>
      <div className={`${cols} px-1 text-[10px] uppercase tracking-[0.25em] text-[#7d7262]`}>
        <span>#</span><span>Driver</span><span>Time</span><span>Wrecks</span><span>Horde</span><span>Scrap</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {rows.map((r, i) => (
          <div key={r.id} className={`${cols} border-t border-[#3a362f] px-1 py-2 text-sm ${r.done ? "" : "opacity-50"} ${r.id === s.me ? "bg-[#25211c]" : ""}`}>
            <span className="sw-display text-[#a8987f]">{r.done ? i + 1 : "-"}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate sw-display text-[#eadfc8]">{r.won && <Trophy className="h-3.5 w-3.5 shrink-0 text-[#f2c230]" />}{r.name}{!r.done && <span className="text-[10px] text-[#a8987f]"> playing...</span>}</span>
            <span className="text-[#e9dcc4]">{r.done ? fmt(r.time) : ""}</span>
            <span className="text-right text-[#e9dcc4]">{r.wrecks}</span>
            <span className="text-right text-[#e9dcc4]">{r.kills}</span>
            <span className="text-right sw-display text-[#f2c230]">{r.payout}</span>
          </div>
        ))}
        {!rows.length && <div className="py-6 text-center text-sm text-[#7d7262]">Waiting for the first result...</div>}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-[#3a362f] pt-3">
        <button onClick={() => L.leave()} className="sw-btn px-4 py-2 text-sm">Leave lobby</button>
        {s.role === "host" ? <button disabled={!closed} onClick={() => L.back()} className="sw-btn sw-btn-primary px-6 py-2 text-sm disabled:opacity-40">Back to lobby</button>
          : <span className="self-center text-xs text-[#a8987f]">{closed ? "The host takes everyone back" : ""}</span>}
      </div>
    </div>
  );
}