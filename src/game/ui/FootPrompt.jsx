// On-foot prompts above the bars: E to get out / get in / use, Z to summon, and the zone-edge warning.
function Key({ k, children, hot }) {
  return (
    <div className={`sw-panel flex items-center gap-2 px-3 py-1 text-sm ${hot ? "text-[#f2c230] sw-pulse" : "text-[#efe3cb]"}`}>
      <span className="rounded-sm bg-[#f2c230] px-1.5 text-xs font-bold text-[#1b140b]">{k}</span>
      <span className="uppercase tracking-[0.15em]">{children}</span>
    </div>
  );
}

export default function FootPrompt({ foot }) {
  if (!foot) return null;
  return (
    <div className="absolute bottom-40 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {foot.edge && <div className="sw-display text-sm tracking-widest text-[#ff8a6a] drop-shadow-[0_2px_0_#000]">GET IN A VEHICLE TO LEAVE THE SAFE ZONE</div>}
      {foot.prompt && <Key k="E" hot>{foot.prompt}</Key>}
      {foot.summon && <Key k="Z">Summon from your garage</Key>}
      {foot.on && <div className="text-[11px] uppercase tracking-[0.2em] text-[#a8987f]">WASD walk · Shift run · Space jump</div>}
    </div>
  );
}