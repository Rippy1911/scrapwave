import LobbyHeader from "@/game/ui/lobby/LobbyHeader";
import PlayerList from "@/game/ui/lobby/PlayerList";
import RidePicker from "@/game/ui/lobby/RidePicker";
import LobbyRules from "@/game/ui/lobby/LobbyRules";
import LobbyChat from "@/game/ui/lobby/LobbyChat";

// The lobby room: players, your ride, the rules (host edits), chat, and Ready / Start / Leave.
export default function LobbyRoom({ s, save, L }) {
  const l = s.lobby, host = s.role === "host";
  const mine = l.players.find((p) => p.id === s.me);
  const inMatch = l.phase !== "lobby";
  return (
    <div className="sw-panel sw-slide flex max-h-[92vh] w-full max-w-5xl flex-col gap-3 px-5 py-4">
      <LobbyHeader s={s} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:flex-row">
        <div className="flex flex-col gap-4 md:w-72 md:shrink-0">
          <PlayerList lobby={l} me={s.me} />
          <RidePicker save={save} rules={l.rules} ride={mine && mine.ride} locked={inMatch} onPick={(r) => L.ride(r)} />
          <LobbyChat lines={s.chat} onSend={(t) => L.chat(t)} />
        </div>
        <div className="min-w-0 flex-1">
          <LobbyRules rules={l.rules} editable={host && !inMatch} onChange={(r) => L.setRules(r)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#3a362f] pt-3">
        <div className="min-w-0 flex-1 text-sm">
          {s.error ? <span className="text-[#ff8a6a]">{s.error}</span>
            : inMatch ? <span className="text-[#f2c230]">Match in progress</span>
            : host ? <span className="text-[#a8987f]">{s.canStart || "Everyone is ready"}</span>
            : <span className="text-[#a8987f]">{mine && mine.ready ? "Waiting for the host to start" : "Pick your ride, then Ready"}</span>}
        </div>
        <button onClick={() => L.leave()} className="sw-btn px-4 py-2 text-sm">Leave</button>
        {host ? <button disabled={!!s.canStart || inMatch} onClick={() => L.start()} className="sw-btn sw-btn-primary px-6 py-2 text-sm disabled:opacity-40">Start</button>
          : <button disabled={inMatch} onClick={() => L.ready(!(mine && mine.ready))} className={`sw-btn px-6 py-2 text-sm disabled:opacity-40 ${mine && mine.ready ? "" : "sw-btn-primary"}`}>{mine && mine.ready ? "Not ready" : "Ready"}</button>}
      </div>
    </div>
  );
}