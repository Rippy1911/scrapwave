import { useState } from "react";

// Poses: the joint preview sliders saved under a name and an optional key 1-9 (press it in play to blend into the
// pose, press again to go back). Click a pose to load it into the sliders.
export default function PosesPanel({ design, ed }) {
  const [name, setName] = useState("Pose");
  const [key, setKey] = useState(0);
  const poses = design.free?.poses || [];
  const hasJoints = Object.keys(ed.preview).length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      {!poses.length && <div className="text-[11px] text-[#8f8270]">No poses yet. Set joint sliders, then save.</div>}
      {poses.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-2 text-[11px]">
          <button type="button" onClick={() => ed.setPreview({ ...p.values })} className="text-left text-[#e9dcc4] hover:text-[#f2c230]">{p.name} <span className="text-[#8f8270]">{p.key ? `· key ${p.key}` : ""} · {Object.keys(p.values).length} joints</span></button>
          <button type="button" onClick={() => ed.ops.removePose(p.name)} className="text-[#ff8a6a]" aria-label={`Delete pose ${p.name}`}>✕</button>
        </div>
      ))}
      <div className="flex gap-1">
        <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-sm border border-[#46413a] bg-[#171513] px-1 text-[11px] text-[#e9dcc4]" aria-label="Pose name" />
        <select value={key} onChange={(e) => setKey(+e.target.value)} className="rounded-sm border border-[#46413a] bg-[#171513] px-1 text-[11px] text-[#e9dcc4]" aria-label="Pose key">
          <option value={0}>no key</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => <option key={k} value={k}>key {k}</option>)}
        </select>
        <button type="button" disabled={!hasJoints || !name.trim()} onClick={() => ed.ops.savePose(name.trim(), key)} className="sw-btn px-2 py-0.5 text-[10px] disabled:opacity-40">Save</button>
      </div>
      <button type="button" onClick={() => ed.setPreview({})} className="sw-btn self-start px-2 py-0.5 text-[10px]">Reset sliders</button>
    </div>
  );
}