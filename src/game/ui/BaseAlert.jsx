// Base under attack: a red pulsing arrow at the screen edge pointing home, plus the alert line.
// Also the claim meter (circular, 5 s) and the plot prompt, and a small panel for your own base.
export default function BaseAlert({ alert, claim, prompt, myBase, padRepair }) {
  return (
    <>
      {alert && <HomeArrow a={alert.a} />}
      {alert && (
        <div className="absolute left-1/2 top-[86px] -translate-x-1/2 sw-panel border-[#ff3a20] px-4 py-1.5 text-center sw-pulse">
          <div className="sw-display text-sm tracking-[0.2em] text-[#ff4a2a]">BASE ALERT · {alert.d} m</div>
          <div className="text-xs text-[#f4ead6]">{alert.text}</div>
        </div>
      )}
      {claim && <ClaimMeter k={claim.k} />}
      {!claim && prompt && <div className="absolute left-1/2 top-[62%] -translate-x-1/2 sw-panel px-3 py-1 text-sm text-[#f2c230]">{prompt}</div>}
      {padRepair && <div className="absolute left-1/2 top-[66%] -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-[#7fe0a0] sw-pulse">Garage pad · repairing</div>}
      {myBase && (
        <div className="absolute left-4 top-[118px] w-52 sw-panel px-3 py-1.5">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.25em]"><span className="text-[#a8987f]">Your base</span><span className={myBase.dark ? "text-[#ff5a3a]" : "text-[#7fe0a0]"}>{myBase.dark ? "dark" : myBase.raiders ? `${myBase.raiders} raiders` : "lit"}</span></div>
          <div className="text-sm font-bold text-[#f4ead6]">{myBase.name} · <span className="text-[#7fe0a0]">{myBase.stash}</span> stash</div>
          <div className="mt-1 h-1.5 bg-[#0e0c0a]"><div className="h-full bg-[#f2c230]" style={{ width: `${myBase.rig * 100}%` }} /></div>
          {myBase.siphon && <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#ff4a2a] sw-pulse">Siphon {Math.round(myBase.siphon.k * 100)}% · {myBase.siphon.by}</div>}
        </div>
      )}
    </>
  );
}

function HomeArrow({ a }) {
  const cx = Math.cos(a), cy = Math.sin(a);
  const k = Math.min(0.45 / Math.max(0.001, Math.abs(cx)), 0.42 / Math.max(0.001, Math.abs(cy)));
  return (
    <div className="absolute sw-pulse" style={{ left: `${50 + cx * k * 100}%`, top: `${50 + cy * k * 100}%`, transform: `translate(-50%,-50%) rotate(${a}rad)` }}>
      <div className="flex items-center gap-1">
        <div className="h-4 w-6 bg-[#ff2a10]" />
        <div className="h-0 w-0 border-y-[18px] border-l-[30px] border-y-transparent border-l-[#ff2a10] drop-shadow-[0_0_10px_rgba(255,42,16,0.9)]" />
      </div>
    </div>
  );
}

function ClaimMeter({ k }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="absolute left-1/2 top-[58%] -translate-x-1/2 flex flex-col items-center">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="rgba(18,16,14,0.7)" stroke="#46413a" strokeWidth="7" />
        <circle cx="45" cy="45" r={r} fill="none" stroke="#f2c230" strokeWidth="7" strokeDasharray={c} strokeDashoffset={c * (1 - k)} transform="rotate(-90 45 45)" strokeLinecap="butt" />
        <text x="45" y="52" textAnchor="middle" className="sw-display" fill="#f4ead6" fontSize="20">{Math.round(k * 100)}%</text>
      </svg>
      <div className="mt-1 text-xs uppercase tracking-[0.3em] text-[#f2c230]">Claiming · hold still</div>
    </div>
  );
}