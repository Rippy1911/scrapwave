// One first-session hint card, slid in on the left.
export default function HintCard({ hint }) {
  if (!hint) return null;
  return (
    <div key={hint.id} className="sw-hud-hint absolute left-4 top-[22%] w-72 md:w-80 sw-panel sw-slide px-4 py-3">
      <div className="h-1.5 -mx-4 -mt-3 mb-3 sw-hazard" />
      <div className="sw-display text-lg text-[#f2c230] tracking-wider">{hint.title}</div>
      <div className="mt-1 text-sm leading-snug text-[#e9dcc4]">{hint.body}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {hint.keys.map((k) => (
          <span key={k} className="rounded-sm border border-[#57503f] border-b-[3px] bg-[#26231f] px-2 py-0.5 text-[11px] font-bold text-[#f2c230]">{k}</span>
        ))}
      </div>
    </div>
  );
}