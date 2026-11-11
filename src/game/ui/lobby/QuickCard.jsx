import { useEffect } from "react";

const secs = (n) => `${n} s`;

// What Quick play is doing, in words (q = game.quick.state()).
export function quickLine(q) {
  switch (q.phase) {
    case "connecting": return "Connecting to the Saltreach server";
    case "searching": return "Looking for an open lobby";
    case "joining": return `Joining ${q.lobbyName || "a lobby"}`;
    case "hosting": return q.players > 1
      ? `${q.players} drivers here · AI bots fill the rest in ${secs(q.left)}`
      : `Nobody else yet · AI bots join in ${secs(q.left)}`;
    case "waiting": return `In ${q.lobbyName || "a lobby"} · ${q.players} drivers · waiting for the host to start`;
    case "starting": return q.note ? `Waiting: ${q.note}` : "Starting the match";
    default: return "";
  }
}

// Quick play: "Finding a match..." with a Cancel. When the lobby service cannot be reached or fails it says so
// plainly; nothing local starts until the player presses "Play offline".
export default function QuickCard({ q, onCancel, onRetry, onOffline }) {
  const failed = q.phase === "failed";
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="sw-panel sw-slide w-full max-w-md px-6 py-5 text-center" data-quick={q.phase}>
      {failed ? (
        <>
          <div className="sw-display text-2xl tracking-widest text-[#ff8a6a]">{q.offline ? "CAN'T GO ONLINE" : "NO MATCH STARTED"}</div>
          <div className="mt-3 text-sm text-[#e9dcc4]">
            {q.offline ? "You are offline, or the Saltreach lobby server did not answer." : "The lobby service did not finish setting up a match."}
            {" "}Nothing was started.
          </div>
          {q.error && <div className="mt-1 text-xs text-[#a8987f]">{q.error}</div>}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onRetry} className="sw-btn sw-btn-primary px-5 py-2 text-sm">Try again</button>
            <button type="button" onClick={onOffline} className="sw-btn px-5 py-2 text-sm">Play offline</button>
            <button type="button" onClick={onCancel} className="sw-btn px-5 py-2 text-sm">Back</button>
          </div>
        </>
      ) : (
        <>
          <div className="sw-display text-2xl tracking-widest text-[#f2c230]">Finding a match...</div>
          <div className="mt-1 min-h-[1.25rem] text-xs uppercase tracking-[0.2em] text-[#a8987f]">{quickLine(q)}</div>
          <div className="relative mt-4 h-2 overflow-hidden bg-[#0e0c0a]"><div className="absolute top-0 h-full w-1/4 bg-[#f2c230] sw-fill" /></div>
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={onCancel} className="sw-btn px-6 py-2 text-sm">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
