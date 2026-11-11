import MaterialPicker from "@/game/ui/build/MaterialPicker";
import PiecePalette from "@/game/ui/build/PiecePalette";
import PieceCapMeter from "@/game/ui/build/PieceCapMeter";

// Piece mode tray: material and tier, the piece palette and the cap meter.
export default function PieceTray({ pc, onSelect, placer }) {
  return (
    <>
      <MaterialPicker mat={pc.mat} tier={pc.tier} onMat={(m) => placer.setMat(m)} onTier={(t) => placer.setTier(t)} />
      <div className="mx-1 w-px shrink-0 bg-[#46413a]" />
      <PiecePalette pieces={pc.pieces} sel={pc.sel} onSelect={onSelect} />
      <div className="mx-1 w-px shrink-0 bg-[#46413a]" />
      <PieceCapMeter count={pc.count} cap={pc.cap} funds={pc.funds} />
    </>
  );
}