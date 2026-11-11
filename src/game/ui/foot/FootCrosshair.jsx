// On-foot crosshair at the screen centre, which is the line of fire (onfoot/footCam.js): four ticks that close up
// when you aim, a centre dot and the hit marker. Dim while weapons are cold in a safe zone or the hands are empty.
// Through the scope the reticle is ScopeOverlay's.
export default function FootCrosshair({ c, hitRecent }) {
  if (c.scope || c.dead) return null;
  const gap = c.aiming ? 5 : 11;
  const tick = `absolute shadow-[0_0_2px_#000] transition-all duration-100 ${c.safe || !c.held ? "bg-[#8d8474]" : "bg-[#f2e6c8]"}`;
  return (
    <div className="absolute left-1/2 top-1/2 h-0 w-0">
      <div className={`${tick} h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full`} />
      <div className={`${tick} h-2 w-[2px] -translate-x-1/2`} style={{ top: gap }} />
      <div className={`${tick} h-2 w-[2px] -translate-x-1/2`} style={{ bottom: gap }} />
      <div className={`${tick} h-[2px] w-2 -translate-y-1/2`} style={{ left: gap }} />
      <div className={`${tick} h-[2px] w-2 -translate-y-1/2`} style={{ right: gap }} />
      {hitRecent && <div className="absolute -left-3 -top-3 h-6 w-6 rotate-45 border-2 border-[#ffd54a]" />}
    </div>
  );
}