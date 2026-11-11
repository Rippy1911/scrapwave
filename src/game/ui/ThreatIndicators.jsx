// Red arrows at the screen edge for anyone aiming at you, plus the "LOCKED ON" rocket warning.
export default function ThreatIndicators({ threats = [], lockedOn }) {
  return (
    <>
      {threats.map((t) => {
        const cx = Math.cos(t.a), cy = Math.sin(t.a);
        const k = Math.min(0.46 / Math.max(0.001, Math.abs(cx)), 0.44 / Math.max(0.001, Math.abs(cy)));
        const left = t.on ? 50 + t.x * 50 : 50 + cx * k * 100;
        const top = t.on ? 50 - t.y * 50 : 50 + cy * k * 100;
        return (
          <div key={t.id} className="absolute" style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%,-50%) rotate(${t.a}rad)` }}>
            {t.on ? (
              <div className="h-7 w-7 rotate-45 border-2 border-[#ff3a20] sw-pulse" />
            ) : (
              <div className="flex items-center">
                <div className="h-0 w-0 border-y-[11px] border-l-[22px] border-y-transparent border-l-[#ff3a20] drop-shadow-[0_0_6px_rgba(255,58,32,0.8)]" />
              </div>
            )}
          </div>
        );
      })}
      {lockedOn && (
        <div className="absolute left-1/2 top-[30%] -translate-x-1/2 sw-display text-2xl md:text-3xl tracking-[0.25em] text-[#ff3a20] drop-shadow-[0_2px_0_#000] sw-pulse">
          LOCKED ON
        </div>
      )}
    </>
  );
}