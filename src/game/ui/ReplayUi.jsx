// Instant-replay UI: the 6 s "Replay" offer button, and the REPLAY badge with progress while one plays.
export default function ReplayUi({ hud, onReplay }) {
  if (!hud) return null;
  if (hud.replaying) {
    const r = hud.replaying;
    return (
      <div className="pointer-events-none fixed inset-0 select-none sw-body">
        <div className="absolute left-6 top-[9vh] flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-sm bg-[#ff4a2a] px-3 py-1 sw-display text-lg tracking-[0.2em] text-[#1b0b05]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1b0b05] sw-pulse" />REPLAY
          </span>
          <span className="text-sm uppercase tracking-[0.3em] text-[#efe3cb] drop-shadow-[0_2px_0_#000]">{r.label}</span>
        </div>
        <div className="absolute left-6 right-6 bottom-[9vh] flex items-center gap-4">
          <div className="h-1 flex-1 bg-[rgba(255,255,255,0.2)]"><div className="h-full bg-[#f2c230]" style={{ width: `${Math.min(1, r.k) * 100}%` }} /></div>
          <span className="text-xs uppercase tracking-[0.3em] text-[#efe3cb]">Esc to skip</span>
        </div>
      </div>
    );
  }
  const o = hud.replayOffer;
  if (!o) return null;
  return (
    // Bottom-centre, below the car (the speedo is in the bottom-right corner); on the right it sat on the radio job card.
    <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
      <button onClick={onReplay} className="pointer-events-auto sw-btn sw-btn-primary sw-slide flex items-center gap-2 px-4 py-2 text-sm">
        <span className="rounded-sm border border-[#7a5410] bg-[#1b140b] px-1.5 text-[11px] text-[#f2c230]">V</span>
        Replay · {o.label}
        <span className="text-[11px] opacity-70">{Math.ceil(o.left)}</span>
      </button>
    </div>
  );
}