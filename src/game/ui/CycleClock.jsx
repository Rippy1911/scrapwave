const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Top-centre cycle clock; during the storm it counts the storm down and warns when you're inside it.
export default function CycleClock({ cycle, storm }) {
  if (!cycle) return null;
  const late = !cycle.storm && cycle.left <= 300;
  return (
    <>
      <div className="sw-hud-clock absolute left-1/2 top-3 -translate-x-1/2 text-center sw-body">
        <div className={`sw-panel px-4 py-1 ${cycle.storm ? "border-[#ff6a2a]" : ""}`}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#a8987f]">Cycle {cycle.n}{cycle.short ? " · short" : ""}</div>
          <div className={`sw-display text-2xl leading-none tracking-wider ${cycle.storm ? "text-[#ff8a3a] sw-pulse" : late ? "text-[#ffcf7a]" : "text-[#f4ead6]"}`}>
            {cycle.storm ? fmt(cycle.stormLeft) : fmt(cycle.left)}
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">{cycle.storm ? "Dust storm" : "Until the storm"}</div>
        </div>
        {cycle.inside && <div className="mt-2 sw-display text-sm tracking-[0.2em] text-[#ff4a2a] sw-pulse drop-shadow-[0_2px_0_#000]">IN THE STORM · −30 HULL/S</div>}
      </div>
      {storm > 0.05 && <StormGrain k={storm} />}
    </>
  );
}

function StormGrain({ k }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity: Math.min(0.75, k), mixBlendMode: "overlay" }}>
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="sw-grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"><animate attributeName="seed" values="1;9;3;7;5" dur="0.4s" repeatCount="indefinite" /></feTurbulence></filter>
        <rect width="100%" height="100%" filter="url(#sw-grain)" fill="#c08a52" />
      </svg>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(160,96,44,0) 30%, rgba(120,62,24,0.55) 100%)" }} />
    </div>
  );
}