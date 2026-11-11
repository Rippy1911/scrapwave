import { useState } from "react";
import LobbyRow from "@/game/ui/lobby/LobbyRow";

// Find a game: the lobbies heard in this room (name, mode, map, players, ping), join by tapping or by a code.
export default function LobbyBrowser({ s, onJoin, onBack }) {
  const [code, setCode] = useState("");
  const [locked, setLocked] = useState(null); // a locked lobby waiting for its code
  const tap = (b) => { if (b.locked) { setLocked(b); setCode(""); } else onJoin(b.id, ""); };
  const submit = () => { if (!code) return; if (locked) onJoin(locked.id, code); else onJoin(code, ""); };
  return (
    <div className="sw-panel sw-slide w-full max-w-3xl px-5 py-4 flex max-h-[90vh] flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#5a1e08]">FIND A GAME</div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#a8987f]">{s.online ? `Room ${s.shard || "?"} · lobbies refresh every few seconds` : "Offline"}</div>
        </div>
        {s.busy && <div className="text-xs uppercase tracking-[0.2em] text-[#f2c230] sw-pulse">{s.busy}</div>}
      </div>
      <div className="hidden grid-cols-[1.6fr_1fr_1fr_auto_auto] gap-3 px-2 text-[10px] uppercase tracking-[0.25em] text-[#7d7262] sm:grid">
        <span>Lobby</span><span>Mode</span><span>Map</span><span>Players</span><span className="w-14 text-right">Ping</span>
      </div>
      <div className="min-h-[8rem] flex-1 overflow-y-auto">
        {s.list.length ? s.list.map((b) => <LobbyRow key={b.id} b={b} onJoin={tap} />)
          : <div className="py-10 text-center text-sm text-[#7d7262]">{s.online ? "No open lobbies yet. Host one from Custom Game, or join with a code." : "Connect to see lobbies."}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#3a362f] pt-3">
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">{locked ? `Code for ${locked.name}` : "Join with a code"}</span>
        <input value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="CODE" className="w-32 bg-[#141210] border border-[#57503f] px-2 py-1.5 sw-display text-sm tracking-[0.3em] text-[#f4ead6]" />
        <button disabled={!code || !!s.busy} onClick={submit} className="sw-btn sw-btn-primary px-4 py-1.5 text-sm disabled:opacity-40">Join</button>
        {locked && <button onClick={() => setLocked(null)} className="text-xs text-[#a8987f] hover:text-[#f2c230]">Cancel</button>}
        <div className="flex-1" />
        <button onClick={onBack} className="sw-btn px-4 py-1.5 text-sm">Back</button>
      </div>
      {s.error && <div className="text-sm text-[#ff8a6a]">{s.error}</div>}
    </div>
  );
}