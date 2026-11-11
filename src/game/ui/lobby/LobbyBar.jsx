// During a lobby match: the lobby's name and round, End round (host) and Leave.
export default function LobbyBar({ s, L }) {
  const l = s.lobby;
  const here = l.players.filter((p) => !p.dropped).length;
  return (
    <div className="pointer-events-auto fixed left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-2 sw-panel px-3 py-1 sw-body text-xs text-[#e9dcc4]">
      <span className="sw-display text-[#f2c230]">{l.name}</span>
      <span className="text-[#a8987f]">Round {l.round} · {here} players</span>
      {s.role === "host" && <button onClick={() => L.endMatch()} className="sw-btn px-2 py-0.5 text-[10px]">End round</button>}
      <button onClick={() => L.leave()} className="sw-btn px-2 py-0.5 text-[10px]">Leave</button>
    </div>
  );
}