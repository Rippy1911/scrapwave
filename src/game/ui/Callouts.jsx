// Big stunt/wreck callouts and a small event feed.
export default function Callouts({ big, feed }) {
  return (
    <div className="pointer-events-none fixed inset-0 select-none">
      <div className="absolute left-1/2 top-[18%] -translate-x-1/2 flex flex-col items-center gap-1">
        {big.slice(-2).map((c) => (
          <div key={c.id} className="sw-pop text-center">
            <div className="sw-display text-4xl md:text-5xl tracking-wider drop-shadow-[0_4px_0_#2a0f05]" style={{ color: c.color }}>{c.text}</div>
            {c.sub && <div className="sw-body text-sm uppercase tracking-[0.3em] text-[#efe3cb] drop-shadow-[0_2px_0_#000]">{c.sub}</div>}
          </div>
        ))}
      </div>
      <div className="sw-hud-feed absolute left-4 top-24 flex flex-col gap-1">
        {feed.slice(-5).map((f) => (
          <div key={f.id} className="sw-slide sw-body text-xs uppercase tracking-[0.25em] text-[#f2c230] drop-shadow-[0_1px_0_#000]">{f.text}</div>
        ))}
      </div>
    </div>
  );
}