import { FREE_PARTS, JOINT_ROLES, freeWeaponsFor, isJoint } from "@/game/workshop/freeParts";
import { findPart } from "@/game/workshop/freeEdit";
import { WEAPONS } from "@/game/data/tuning";

const Sel = ({ label, value, onChange, children }) => (
  <label className="flex items-center justify-between gap-2 text-[11px] text-[#a8987f]">{label}
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-36 rounded-sm border border-[#46413a] bg-[#171513] px-1 py-0.5 text-[#e9dcc4]">{children}</select>
  </label>
);

// Settings of the selected part: tier, the joint it hangs on, its weapon, and for joints the role, key, limits and
// spin, plus a preview slider (saved into poses in the Poses panel).
export default function JointsPanel({ design, ed }) {
  const part = ed.sel[0] ? findPart(design, ed.sel[0]) : null;
  if (!part) return <div className="text-xs text-[#8f8270]">Select a part to set its tier, joint, weapon and key.</div>;
  const d = FREE_PARTS[part.t], set = ed.ops.props, joints = (design.free?.parts || []).filter((p) => isJoint(p.t) && p.id !== part.id);
  const pv = ed.preview[part.id] ?? 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="sw-display text-sm text-[#f2c230]">{d.name} <span className="font-sans text-[10px] text-[#8f8270]">#{part.id}{part.mir ? ` · twin #${part.mir}` : ""}</span></div>
      <Sel label="Tier" value={part.tier} onChange={(v) => set({ tier: +v })}>{[1, 2, 3].map((t) => <option key={t} value={t}>{["I Scrap", "II Welded", "III War-forged"][t - 1]}</option>)}</Sel>
      <Sel label="Hangs on" value={part.limb || ""} onChange={(v) => set({ limb: v ? +v : null })}>
        <option value="">Frame</option>
        {joints.map((j) => <option key={j.id} value={j.id}>{FREE_PARTS[j.t].name} #{j.id}{j.role ? ` (${j.role})` : ""}</option>)}
      </Sel>
      {d.mount && part.wpn && (
        <>
          <Sel label="Weapon" value={part.wpn.id} onChange={(v) => set({ wpn: { ...part.wpn, id: v } })}>{freeWeaponsFor(part.t).map((w) => <option key={w} value={w}>{WEAPONS[w].name}</option>)}</Sel>
          <Sel label="Weapon tier" value={part.wpn.tier} onChange={(v) => set({ wpn: { ...part.wpn, tier: +v } })}>{[1, 2, 3].map((t) => <option key={t} value={t}>Tier {t}</option>)}</Sel>
        </>
      )}
      {d.joint && (
        <>
          <Sel label="Role" value={part.role || ""} onChange={(v) => set({ role: v || null })}>{JOINT_ROLES.map((r) => <option key={r} value={r}>{r || "none"}</option>)}</Sel>
          <Sel label="Key" value={part.key || ""} onChange={(v) => set({ key: v ? +v : null })}><option value="">none</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => <option key={k} value={k}>{k}</option>)}</Sel>
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#a8987f]">Limits
            <span className="flex gap-1">
              <input type="number" step="0.1" value={part.min} onChange={(e) => set({ min: +e.target.value })} className="w-16 rounded-sm border border-[#46413a] bg-[#171513] px-1 text-[#e9dcc4]" aria-label="Minimum" />
              <input type="number" step="0.1" value={part.max} onChange={(e) => set({ max: +e.target.value })} className="w-16 rounded-sm border border-[#46413a] bg-[#171513] px-1 text-[#e9dcc4]" aria-label="Maximum" />
            </span>
          </div>
          {(part.t === "rotor" || part.t === "motor") && (
            <label className="flex items-center gap-2 text-[11px] text-[#a8987f]"><input type="checkbox" checked={!!part.spin} onChange={(e) => set({ spin: e.target.checked || null })} /> Spins freely while its key is held</label>
          )}
          <label className="text-[11px] text-[#a8987f]">Preview {pv.toFixed(2)}{d.joint === "piston" ? " m" : " rad"}
            <input type="range" min={part.min} max={part.max} step="0.01" value={pv} onChange={(e) => ed.setPreview({ ...ed.preview, [part.id]: +e.target.value })} className="w-full accent-[#f2c230]" />
          </label>
        </>
      )}
    </div>
  );
}