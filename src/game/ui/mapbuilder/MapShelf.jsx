import { encodeMap, decodeMap } from "@/game/arena/custom/mapData";

// Your saved maps, plus map codes: copy this map's code to share it, paste someone else's to load it.
export default function MapShelf({ map, mine, onLoad, onDelete, onMsg }) {
  const copy = async () => {
    const code = encodeMap(map);
    try { await navigator.clipboard.writeText(code); onMsg("Map code copied."); } catch { window.prompt("Copy this map code", code); }
  };
  const paste = () => {
    const m = decodeMap(window.prompt("Paste a map code"));
    if (m) { onLoad(m); onMsg(`Loaded "${m.name}". Save it to keep it.`); } else onMsg("That is not a map code.");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Your maps</div>
      {mine.length === 0 && <div className="text-xs text-[#7d7262]">None saved yet.</div>}
      {mine.map((m) => (
        <div key={m.name} className={`flex items-center justify-between gap-1 px-2 py-1 text-sm ${m.name === map.name ? "bg-[#3a3122] text-[#f2c230]" : "text-[#e9dcc4]"}`}>
          <button type="button" onClick={() => onLoad(m)} className="min-h-[32px] flex-1 truncate text-left">{m.name} <span className="text-xs text-[#a8987f]">· {m.pieces.length}</span></button>
          <button type="button" aria-label={`Delete ${m.name}`} onClick={() => onDelete(m.name)} className="px-2 text-xs text-[#a8987f] hover:text-[#ff6a4a]">✕</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={copy} className="sw-btn px-3 py-1.5 text-[11px]">Copy map code</button>
        <button type="button" onClick={paste} className="sw-btn px-3 py-1.5 text-[11px]">Paste a code</button>
      </div>
    </div>
  );
}