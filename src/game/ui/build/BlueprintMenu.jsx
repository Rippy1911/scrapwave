import { useState } from "react";
import { Save, Download, X } from "lucide-react";
import BlueprintRow from "@/game/ui/build/BlueprintRow";

// Named blueprints of your plot: save the layout, load (rebuilds only what is missing), rename, delete,
// copy a share code and import one.
export default function BlueprintMenu({ list, bp, onClose }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState(null);
  const say = (t) => { setNote(t); setTimeout(() => setNote((n) => (n === t ? null : n)), 3000); };
  const save = () => { if (bp.save(name)) { say(`Saved ${name.trim()}`); setName(""); } else say("Name it first"); };
  const load = (n) => { const r = bp.load(n); say(r ? `${r.placed} built · ${r.kept} standing${r.short ? ` · ${r.short} short of scrap` : ""}` : "Claim a plot first"); };
  const exp = async (n) => {
    const c = bp.exportCode(n);
    try { await navigator.clipboard.writeText(c); say("Share code copied"); } catch { setCode(c); say("Copy the code below"); }
  };
  const imp = () => { const n = bp.importCode(code); say(n ? `Imported ${n}` : "That code doesn't work"); if (n) setCode(""); };

  return (
    <div className="pointer-events-auto fixed bottom-44 right-3 z-30 w-[340px] max-w-[calc(100vw-24px)] sw-panel p-3 sw-body sw-slide">
      <div className="mb-2 flex items-center justify-between">
        <span className="sw-display text-sm tracking-wider text-[#f2c230]">Blueprints</span>
        <button onClick={onClose} className="text-[#a8987f] hover:text-[#f2c230]"><X className="h-4 w-4" /></button>
      </div>
      <div className="mb-2 flex gap-1">
        <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Blueprint name"
          className="min-w-0 flex-1 rounded-sm border border-[#57503f] bg-[#11100f] px-2 py-1 text-xs text-[#e9dcc4] outline-none" />
        <button onClick={save} className="sw-btn flex items-center gap-1 px-2 text-[10px]"><Save className="h-3.5 w-3.5" />Save</button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {list.length ? list.map((b) => (
          <BlueprintRow key={b.name} bp={b} missing={bp.missing(b.name)} onLoad={() => load(b.name)} onExport={() => exp(b.name)}
            onRename={(to) => say(bp.rename(b.name, to) ? `Renamed to ${to}` : "Name taken")} onDelete={() => { bp.remove(b.name); say(`Deleted ${b.name}`); }} />
        )) : <div className="py-3 text-center text-xs text-[#a8987f]">No blueprints yet. Build something and save it.</div>}
      </div>
      <div className="mt-2 flex gap-1">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a share code (SWB1...)"
          className="min-w-0 flex-1 rounded-sm border border-[#57503f] bg-[#11100f] px-2 py-1 text-xs text-[#e9dcc4] outline-none" />
        <button onClick={imp} disabled={!code} className="sw-btn flex items-center gap-1 px-2 text-[10px] disabled:opacity-40"><Download className="h-3.5 w-3.5" />Import</button>
      </div>
      {note && <div className="mt-2 text-center text-xs text-[#7fe0a0]">{note}</div>}
    </div>
  );
}