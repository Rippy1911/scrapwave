// The four on-foot slots (keys 1 to 4): the long gun and the sidearm show rounds in the magazine / spare rounds,
// grenades and C4 show a count (and how many charges are lying out). The slot in the hands is lit, an empty one dimmed.
const TIER = ["", "I", "II", "III"];
const SHORT = { long: "Long gun", side: "Sidearm", grenade: "Grenades", c4: "C4" };

export default function FootSlots({ c }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {c.slots.map((s) => {
        const gun = s.mag !== null, out = s.slot === "c4" ? c.placed : 0;
        const has = s.tier > 0 && (gun || s.n > 0 || out > 0);
        const dry = gun && s.mag + s.spare === 0;
        const lit = has && c.sel === s.slot;
        return (
          <div key={s.slot} className={`border px-1.5 py-1 ${lit ? "border-[#f2c230] bg-[rgba(242,194,48,0.14)]" : "border-[#46413a] bg-[#1b1712]"} ${has ? "" : "opacity-40"}`}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="rounded-sm bg-[#f2c230] px-1 font-bold text-[#1b140b]">{s.key}</span>
              <span className="text-[#c9a36a]">{TIER[s.tier]}</span>
            </div>
            <div className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-[#a8987f]">{SHORT[s.slot]}</div>
            <div className={`sw-display text-sm tabular-nums ${dry ? "text-[#ff4a2a]" : "text-[#f2e6c8]"}`}>
              {!has ? "-" : gun ? <>{s.mag}<span className="text-[10px] text-[#a8987f]"> / {s.spare}</span></> : `x${s.n}`}
              {out > 0 && <span className="text-[10px] text-[#ff8a6a]"> +{out}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}