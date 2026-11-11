// Free-build numbers: total mass, centre of mass, power-to-weight and part count, then whether it can stand up
// (Transform Core, 2 or 4 legs) and how it walks: speed, run, jump, fuel burn, and an overload warning.
const Row = ({ label, value, unit, warn }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-[#2a2622] py-0.5">
    <span className="text-[11px] uppercase tracking-[0.15em] text-[#a8987f]">{label}</span>
    <span className={`sw-display text-sm ${warn ? "text-[#ff8a6a]" : "text-[#e9dcc4]"}`}>{value}<span className="ml-1 font-sans text-[10px] text-[#8f8270]">{unit}</span></span>
  </div>
);

export default function FreeStats({ c, count, cap }) {
  const s = c.summary, m = c.mech, w = m && m.walker;
  return (
    <div className="flex flex-col">
      <Row label="Total mass" value={s.mass} unit="kg" />
      <Row label="Centre of mass" value={(s.com || []).map((x) => x.toFixed(2)).join(" / ")} unit="m" />
      <Row label="Power / weight" value={s.pw} unit="kN/t" />
      <Row label="Parts" value={`${count} / ${cap}`} warn={count >= cap} />
      <Row label="Transform Core" value={m && m.core ? "fitted" : "none"} warn={!(m && m.core)} />
      <Row label="Legs" value={m ? m.legs : 0} warn={!(w && w.ok)} />
      {w && (
        <>
          <Row label="Walk / run" value={`${Math.round(w.walk * 3.6)} / ${Math.round(w.run * 3.6)}`} unit="km/h" />
          <Row label="Walker P/W" value={w.pw} unit="kN/t" warn={w.overloaded} />
          <Row label={w.hop ? "Thruster hop" : "Jump"} value={w.jump} unit="m/s" />
          <Row label="Fuel burn" value={`×${w.burn}`} />
        </>
      )}
      {w && w.overloaded && <div className="mt-1 text-[11px] text-[#ff8a6a]">Overloaded: a heavy walker needs a bigger reactor or it crawls.</div>}
      {m && m.core && !w.ok && <div className="mt-1 text-[11px] text-[#ff9a52]">Set two or four joints to the hip role to make legs.</div>}
    </div>
  );
}