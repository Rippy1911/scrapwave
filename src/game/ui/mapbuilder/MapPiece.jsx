import { KINDS } from "@/game/arena/custom/kinds";

// One piece on the map builder's top-down plan. n: the checkpoint's place in the order (checkpoints only).
export default function MapPiece({ p, n }) {
  const K = KINDS[p.k];
  if (K.group === "solid" || K.group === "ramp") {
    const tip = -K.d / 2 + 1.2;
    return (
      <g transform={`translate(${p.x} ${p.z}) rotate(${-p.r * 45})`}>
        <rect x={-K.w / 2} y={-K.d / 2} width={K.w} height={K.d} fill={p.c || K.color} stroke="#14110e" strokeWidth="0.3" />
        {K.group === "ramp" && <path d={`M0 ${K.d / 2 - 1} L0 ${tip} M-1.6 ${tip + 2} L0 ${tip} L1.6 ${tip + 2}`} stroke="#14110e" strokeWidth="0.6" fill="none" />}
      </g>
    );
  }
  return (
    <g transform={`translate(${p.x} ${p.z})`}>
      <circle r={K.group === "prop" ? 1.1 : 2} fill={K.color} stroke="#14110e" strokeWidth="0.3" />
      {p.k === "cp" && <text y="0.9" textAnchor="middle" fontSize="2.6" fontWeight="bold" fill="#14110e">{n}</text>}
    </g>
  );
}