// The long gun's scope: a black mask with a round window on the line of fire, hair lines, three drop marks under
// the centre (bullets fall: onfoot/footShots.js) and the zoom step. Q changes the step. step: 1 or 2.
const R = "38vh";
const HAIR = "absolute bg-[#0e0c0a] shadow-[0_0_1px_rgba(242,230,200,0.55)]";

export default function ScopeOverlay({ step }) {
  const mask = `radial-gradient(circle at 50% 50%, transparent 0, transparent ${R}, rgba(0,0,0,0.6) calc(${R} + 0.4vh), #000 calc(${R} + 1.4vh))`;
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: mask }} />
      <div className={`${HAIR} left-1/2 top-1/2 h-px -translate-x-1/2`} style={{ width: `calc(${R} * 2)` }} />
      <div className={`${HAIR} left-1/2 top-1/2 w-px -translate-y-1/2`} style={{ height: `calc(${R} * 2)` }} />
      {[4, 8, 12].map((d) => <div key={d} className={`${HAIR} left-1/2 h-px w-5 -translate-x-1/2`} style={{ top: `calc(50% + ${d}vh)` }} />)}
      <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff4a2a]" />
      <div className="absolute left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-[#c9a36a]" style={{ top: `calc(50% + ${R} + 3vh)` }}>Zoom {step} / 2 · Q changes it</div>
    </div>
  );
}