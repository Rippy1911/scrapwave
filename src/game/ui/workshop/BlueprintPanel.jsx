import { useState } from "react";
import { listBlueprints, saveBlueprint, loadBlueprint, duplicateBlueprint, deleteBlueprint, encodeDesign, decodeDesign } from "@/game/workshop/blueprints";

// Blueprints: save the draft by name (same name = revise), load, duplicate, delete, copy a share code, import one.
export default function BlueprintPanel({ save, design, onLoad, onMsg, noSave }) {
  const [, setTick] = useState(0);
  const [name, setName] = useState(design.name);
  const [code, setCode] = useState("");
  const refresh = () => setTick((t) => t + 1);
  const run = (fn) => { try { fn(); } catch (e) { onMsg(e.message); } refresh(); };
  const copy = (d) => { const c = encodeDesign(d); navigator.clipboard?.writeText(c).then(() => onMsg("Share code copied"), () => onMsg(c)); setCode(c); };
  const list = listBlueprints(save);
  const small = "sw-btn px-2 py-1 text-[10px]";
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Blueprints</div>
      <div className="flex gap-1.5">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={28} placeholder="Blueprint name"
          className="min-w-0 flex-1 rounded-sm border-2 border-[#46413a] bg-[#14120f] px-2 py-1 text-sm text-[#e9dcc4] outline-none focus:border-[#f2c230]" />
        <button type="button" className="sw-btn sw-btn-primary px-3 py-1 text-xs" onClick={() => run(() => { const b = saveBlueprint(save, name, design, noSave); onMsg(`Saved "${b.name}"`); })}>Save</button>
      </div>
      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
        {!list.length && <div className="text-[11px] text-[#8f8270]">No blueprints yet. Save the draft to keep it.</div>}
        {list.map((b) => (
          <div key={b.name} className="flex flex-wrap items-center gap-1 rounded-sm bg-[#1c1a17] px-2 py-1">
            <span className="mr-auto text-xs font-bold text-[#e9dcc4]">{b.name}<span className="ml-1 font-normal text-[#8f8270]">{b.design.parts.chassis.id}</span></span>
            <button type="button" className={small} onClick={() => { onLoad(loadBlueprint(save, b.name)); setName(b.name); onMsg(`Opened "${b.name}"`); }}>Load</button>
            <button type="button" className={small} onClick={() => run(() => onMsg(`Duplicated as "${duplicateBlueprint(save, b.name, null, noSave).name}"`))}>Copy</button>
            <button type="button" className={small} onClick={() => copy(b.design)}>Code</button>
            <button type="button" className={small} onClick={() => run(() => { deleteBlueprint(save, b.name, noSave); onMsg(`Deleted "${b.name}"`); })}>Delete</button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a SW1. share code"
          className="min-w-0 flex-1 rounded-sm border-2 border-[#46413a] bg-[#14120f] px-2 py-1 font-mono text-[11px] text-[#e9dcc4] outline-none focus:border-[#f2c230]" />
        <button type="button" className={small} onClick={() => copy(design)}>Share draft</button>
        <button type="button" className={small} onClick={() => run(() => { const d = decodeDesign(code); onLoad(d); setName(d.name); onMsg(`Imported "${d.name}" (save it to keep it)`); })}>Import</button>
      </div>
    </div>
  );
}