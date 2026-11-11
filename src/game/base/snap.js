// Piece placement on a plot: the 2 m grid (0.5 m in fine mode), snapping to the edges and centres of nearby
// pieces, stacking on whatever stands below, and the checks (inside the plot, nothing in the way, the cap, scrap).
import { BASE } from "@/game/data/tuning";
import { pieceFoot, pieceDef, pieceStats, PIECE_CAP, WORLD_PIECE_CAP } from "@/game/base/pieceCatalog";
import { aabb, overlaps } from "@/game/base/support";

const HALF = BASE.plotSize / 2, GRID = BASE.grid, FINE = 0.5, PULL = 0.8;
const gsnap = (v, size, step) => Math.round((v - size / 2) / step) * step + size / 2;

function nearestCand(v, cands) {
  let best = null, bd = PULL;
  for (const c of cands) { const d = Math.abs(c - v); if (d < bd) { bd = d; best = c; } }
  return best;
}

// Snap a cursor (plot-local) to a placement { lx, lz }.
export function snapPlace(game, plot, kind, cx, cz, yaw, fine) {
  const [fw, fd] = pieceFoot(kind, yaw), step = fine ? FINE : GRID;
  let lx = gsnap(cx, fw, step), lz = gsnap(cz, fd, step);
  const near = game.base.pieces.group(`plot:${plot.id}`).filter((q) => q.alive && Math.hypot(q.wx - plot.x - cx, q.wz - plot.z - cz) < 7);
  const xs = [], zs = [];
  for (const q of near) {
    const a = aabb(q), x0 = a.x0 - plot.x, x1 = a.x1 - plot.x, z0 = a.z0 - plot.z, z1 = a.z1 - plot.z;
    xs.push(x0 - fw / 2, x1 + fw / 2, q.wx - plot.x, x0 + fw / 2, x1 - fw / 2);
    zs.push(z0 - fd / 2, z1 + fd / 2, q.wz - plot.z, z0 + fd / 2, z1 - fd / 2);
  }
  const sx = nearestCand(cx, xs), sz = nearestCand(cz, zs);
  if (sx != null) lx = sx;
  if (sz != null) lz = sz;
  lx = Math.max(-HALF + fw / 2, Math.min(HALF - fw / 2, lx));
  lz = Math.max(-HALF + fd / 2, Math.min(HALF - fd / 2, lz));
  return { lx: Math.round(lx * 100) / 100, lz: Math.round(lz * 100) / 100 };
}

const boxAabb = (b) => {
  const ex = b.hx * Math.abs(b.cos) + b.hz * Math.abs(b.sin), ez = b.hx * Math.abs(b.sin) + b.hz * Math.abs(b.cos);
  return { x0: b.x - ex, x1: b.x + ex, z0: b.z - ez, z1: b.z + ez, y0: b.y - b.hy, y1: b.y + b.hy };
};

// Why a piece can't go here (null = it can): pos, full, cap, blocked, scrap.
export function checkPlace(game, plot, kind, lx, lz, yaw, y0, mat, tier, free = false) {
  const base = game.base, pcs = base.pieces, group = `plot:${plot.id}`;
  const [fw, fd] = pieceFoot(kind, yaw), h = pieceDef(kind).size[1];
  if (Math.abs(lx) + fw / 2 > HALF + 0.01 || Math.abs(lz) + fd / 2 > HALF + 0.01) return "pos";
  if (pcs.group(group).length >= PIECE_CAP) return "full";
  if (pcs.list.length >= WORLD_PIECE_CAP) return "cap";
  const box = { x0: plot.x + lx - fw / 2, x1: plot.x + lx + fw / 2, z0: plot.z + lz - fd / 2, z1: plot.z + lz + fd / 2 };
  for (const q of pcs.group(group)) {
    if (!q.alive || q.fall || q.top <= y0 + 0.05 || q.y0 >= y0 + h - 0.05) continue;
    if (overlaps(box, aabb(q), 0.08)) return "blocked";
  }
  for (const e of base.modules.forPlot(plot.id)) for (const b of e.boxes) {
    const a = boxAabb(b);
    if (a.y1 > y0 + 0.05 && a.y0 < y0 + h && overlaps(box, a, 0.05)) return "blocked";
  }
  if (overlaps(box, { x0: plot.x + HALF - 9.5, x1: plot.x + HALF - 6.5, z0: plot.z - HALF + 6.5, z1: plot.z - HALF + 9.5 }, 0)) return "blocked"; // beacon
  if (!free && base.pieceFunds() < pieceStats(kind, mat, tier).cost) return "scrap";
  return null;
}

// Modules may not be built through pieces standing on the ground.
export function piecesBlock(game, plot, x, z, w, d) {
  const box = { x0: plot.x + x - w / 2, x1: plot.x + x + w / 2, z0: plot.z + z - d / 2, z1: plot.z + z + d / 2 };
  return game.base.pieces.group(`plot:${plot.id}`).some((q) => q.alive && q.ground && overlaps(box, aabb(q), 0.05));
}