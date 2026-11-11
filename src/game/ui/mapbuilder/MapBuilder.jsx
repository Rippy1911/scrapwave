import { useEffect, useState } from "react";
import { KINDS, MAP_R, MAX_PIECES } from "@/game/arena/custom/kinds";
import { currentMap, listMaps, saveMap, deleteMap } from "@/game/arena/custom/store";
import MapCanvas from "@/game/ui/mapbuilder/MapCanvas";
import MapPalette from "@/game/ui/mapbuilder/MapPalette";
import MapShelf from "@/game/ui/mapbuilder/MapShelf";

const FLOORS = [null, "#5a4a2c", "#40302c", "#3b4a44", "#2c3140", "#1d1b22"];
const snap = (v) => Math.round(v / 2) * 2;
const typing = (e) => e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

// Map builder: lay walls, ramps, smashables and markers on a top-down plan of the pen, save it, play it.
// Mouse or finger: pick a piece, tap the plan. R (or Turn) rotates. Start spots and checkpoints you leave out are added.
export default function MapBuilder({ onClose, onPlay }) {
  const [map, setMap] = useState(() => currentMap());
  const [tool, setTool] = useState("wall");
  const [rot, setRot] = useState(0);
  const [mine, setMine] = useState(() => listMaps());
  const [msg, setMsg] = useState("Pick a piece, then tap the plan to place it.");
  useEffect(() => {
    const onKey = (e) => { if (e.code === "KeyR" && !typing(e)) setRot((r) => (r + 1) % 8); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tap = (x, z) => {
    if (tool === "erase") {
      let best = -1, bd = 5;
      map.pieces.forEach((p, i) => { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) setMap({ ...map, pieces: map.pieces.filter((_, i) => i !== best) });
      return;
    }
    const sx = snap(x), sz = snap(z);
    if (Math.hypot(sx, sz) > MAP_R) { setMsg("That spot is too close to the wall."); return; }
    if (map.pieces.length >= MAX_PIECES) { setMsg(`A map holds ${MAX_PIECES} pieces. Erase some first.`); return; }
    if (map.pieces.some((p) => p.k === tool && p.x === sx && p.z === sz)) return;
    setMap({ ...map, pieces: [...map.pieces, { k: tool, x: sx, z: sz, r: KINDS[tool].group === "point" ? 0 : rot }] });
  };
  const save = () => { const m = saveMap(map); setMap(m); setMine(listMaps()); setMsg(`Saved "${m.name}".`); };
  const remove = (name) => { deleteMap(name); setMine(listMaps()); };
  const count = (k) => map.pieces.filter((p) => p.k === k).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(8,6,4,0.9)] p-2 sw-body text-[#e9dcc4] md:p-4">
      <div className="sw-panel flex max-h-[96vh] w-full max-w-6xl flex-col gap-3 overflow-y-auto p-4 sw-slide">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="sw-display text-3xl text-[#f2c230]">MAP BUILDER</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="sw-btn px-4 py-2 text-sm">Back</button>
            <button type="button" onClick={save} className="sw-btn px-4 py-2 text-sm">Save</button>
            <button type="button" onClick={() => { saveMap(map); onPlay(); }} className="sw-btn sw-btn-primary px-6 py-2 text-sm">Save and play</button>
          </div>
        </div>
        <div className="text-sm text-[#f2c230]">{msg}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <MapCanvas map={map} onTap={tap} />
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Name</span>
              <input value={map.name} maxLength={24} onChange={(e) => setMap({ ...map, name: e.target.value })} className="border border-[#57503f] bg-[#141210] px-2 py-1.5 text-sm text-[#f4ead6]" />
            </label>
            <MapPalette tool={tool} onTool={setTool} />
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setRot((r) => (r + 1) % 8)} className="sw-btn px-3 py-1.5 text-[11px]">Turn · {rot * 45}°</button>
              <button type="button" onClick={() => setMap({ ...map, pieces: map.pieces.slice(0, -1) })} className="sw-btn px-3 py-1.5 text-[11px]">Undo</button>
              <button type="button" onClick={() => setMap({ ...map, pieces: [] })} className="sw-btn px-3 py-1.5 text-[11px]">Clear</button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Floor</span>
              {FLOORS.map((f) => <button key={f || "plain"} type="button" aria-label={f ? `Floor ${f}` : "Plain floor"} onClick={() => setMap({ ...map, floor: f })} className={`h-7 w-7 rounded-sm border-2 ${map.floor === f ? "border-[#f2c230]" : "border-[#46413a]"}`} style={{ background: f || "#4a453d" }} />)}
            </div>
            <div className="text-[11px] text-[#a8987f]">{map.pieces.length}/{MAX_PIECES} pieces · {count("spawn")} start spots · {count("cp")} checkpoints. Missing start spots and checkpoints are placed for you. Checkpoints run in the order you place them.</div>
            <MapShelf map={map} mine={mine} onLoad={setMap} onDelete={remove} onMsg={setMsg} />
          </div>
        </div>
      </div>
    </div>
  );
}