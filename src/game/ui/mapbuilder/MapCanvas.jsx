import { MAP_R } from "@/game/arena/custom/kinds";
import MapPiece from "@/game/ui/mapbuilder/MapPiece";

const V = 66; // half the plan's width in metres (the pen wall stands at 64)

// Top-down plan of the pen. Up is the far side of the pen; one square of the grid is 8 m.
// onTap(x, z): where the mouse or a finger went down, in metres from the centre.
export default function MapCanvas({ map, onTap }) {
  const down = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onTap(((e.clientX - r.left) / r.width) * 2 * V - V, ((e.clientY - r.top) / r.height) * 2 * V - V);
  };
  let n = 0;
  return (
    <svg viewBox={`${-V} ${-V} ${2 * V} ${2 * V}`} onPointerDown={down} role="img" aria-label="Map plan" className="aspect-square w-full cursor-crosshair touch-none select-none rounded-sm border-2 border-[#3d3832] bg-[#14110e]">
      <defs>
        <pattern id="sw-map-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="#14110e" strokeOpacity="0.35" strokeWidth="0.2" />
        </pattern>
      </defs>
      <circle r="64" fill={map.floor || "#4a453d"} stroke="#f2c230" strokeWidth="1.2" />
      <circle r="64" fill="url(#sw-map-grid)" />
      <circle r={MAP_R} fill="none" stroke="#14110e" strokeOpacity="0.5" strokeWidth="0.3" strokeDasharray="2 2" />
      {map.pieces.map((p, i) => <MapPiece key={`${i}-${p.k}`} p={p} n={p.k === "cp" ? ++n : 0} />)}
    </svg>
  );
}