// Support: a piece stands on the ground or on another standing piece whose top meets its bottom with the
// footprints overlapping. When a piece breaks, everything that loses its support falls (pieces.js animates it).

export function aabb(p) {
  return { x0: p.wx - p.fw / 2, x1: p.wx + p.fw / 2, z0: p.wz - p.fd / 2, z1: p.wz + p.fd / 2 };
}
export function overlaps(a, b, shrink = 0.15) {
  return a.x0 + shrink < b.x1 && b.x0 + shrink < a.x1 && a.z0 + shrink < b.z1 && b.z0 + shrink < a.z1;
}
const standing = (q) => q.alive && !q.fall && !q.loose;

// Highest standing top under a footprint, at most `maxY` (Infinity = any height). Returns { y, piece } or null.
export function topUnder(list, box, maxY = Infinity, skip = null) {
  let best = null;
  for (const q of list) {
    if (q === skip || !standing(q) || q.top > maxY + 0.05 || !overlaps(box, aabb(q))) continue;
    if (!best || q.top > best.y) best = { y: q.top, piece: q };
  }
  return best;
}

export function supported(p, list) {
  if (p.ground) return true;
  const a = aabb(p);
  for (const q of list) {
    if (q === p || !standing(q) || Math.abs(q.top - p.y0) > 0.4) continue;
    if (overlaps(a, aabb(q))) return true;
  }
  return false;
}

// Every piece of the group that no longer stands (iterated so a whole stack lets go together).
export function unsupported(list) {
  const out = [];
  let again = true;
  while (again) {
    again = false;
    for (const p of list) {
      if (!standing(p) || supported(p, list)) continue;
      p.loose = true; out.push(p); again = true;
    }
  }
  for (const p of out) p.loose = false; // the caller makes them fall
  return out;
}