import { useState } from "react";
import { FolderOpen, Pencil, Trash2, Copy } from "lucide-react";

// One saved blueprint: load (shows what is missing and its cost), rename, copy share code, delete.
export default function BlueprintRow({ bp, missing, onLoad, onRename, onDelete, onExport }) {
  const [name, setName] = useState(null);
  return (
    <div className="flex items-center gap-2 border-b border-[#2e2b27] py-1.5 text-xs">
      {name === null ? (
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold uppercase tracking-wider text-[#e9dcc4]">{bp.name}</div>
          <div className="text-[10px] text-[#a8987f]">{bp.pieces} pieces · {bp.modules} modules{missing ? ` · ${missing.pieces} missing · ${missing.cost} scrap` : ""}</div>
        </div>
      ) : (
        <input autoFocus value={name} maxLength={32} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { onRename(name); setName(null); } if (e.key === "Escape") setName(null); }}
          className="min-w-0 flex-1 rounded-sm border border-[#57503f] bg-[#11100f] px-2 py-1 text-[#e9dcc4] outline-none" />
      )}
      <button onClick={onLoad} title="Load" className="sw-btn px-1.5 py-1"><FolderOpen className="h-3.5 w-3.5" /></button>
      <button onClick={() => setName(name === null ? bp.name : null)} title="Rename" className="sw-btn px-1.5 py-1"><Pencil className="h-3.5 w-3.5" /></button>
      <button onClick={onExport} title="Copy share code" className="sw-btn px-1.5 py-1"><Copy className="h-3.5 w-3.5" /></button>
      <button onClick={onDelete} title="Delete" className="sw-btn px-1.5 py-1 hover:text-[#ff6a4a]"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}