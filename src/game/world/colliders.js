// Static colliders: yawed boxes, ramp wedges and convex hulls in a uniform spatial grid.
// Box: {x,y,z,hx,hy,hz,yaw, kind:'solid'|'wedge'|'hull', tag}. Wedges rise toward local -z (the lip).
// The Rapier world (src/game/vehicles/rapier.js) mirrors every add/remove through listen(), so walls and
// modules built during play collide at once: add(box) or addHull({points}) returns an entry with an id,
// removeById(id) or remove(entry) takes it out again.
const CELL = 16;

export function createColliders() {
  const grid = new Map();
  const all = [];
  const byId = new Map();
  const listeners = new Set();
  let stamp = 1, nextId = 1;
  const key = (cx, cz) => (cx + 500) * 2000 + (cz + 500);

  function cellsOf(b, fn) {
    const r = Math.hypot(b.hx, b.hz);
    const x0 = Math.floor((b.x - r) / CELL), x1 = Math.floor((b.x + r) / CELL);
    const z0 = Math.floor((b.z - r) / CELL), z1 = Math.floor((b.z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) fn(key(i, j));
  }
  function add(b) {
    b.yaw = b.yaw || 0; b.kind = b.kind || "solid";
    b.cos = Math.cos(b.yaw); b.sin = Math.sin(b.yaw);
    b.dead = false; b.mark = 0;
    if (!b.id) b.id = nextId++;
    byId.set(b.id, b);
    cellsOf(b, (k) => { let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(b); });
    all.push(b);
    for (const fn of listeners) fn("add", b);
    return b;
  }
  function remove(b) {
    if (!b || b.dead) return;
    b.dead = true;
    byId.delete(b.id);
    cellsOf(b, (k) => { const l = grid.get(k); if (l) { const i = l.indexOf(b); if (i >= 0) l.splice(i, 1); } });
    for (const fn of listeners) fn("remove", b);
  }
  const removeById = (id) => remove(byId.get(id));
  // Convex hull from world-space points ([[x,y,z],...] or a flat array). Queries use its bounding box.
  function addHull(o) {
    const flat = Array.isArray(o.points[0]) ? o.points.flat() : Array.from(o.points);
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < flat.length; i += 3) {
      x0 = Math.min(x0, flat[i]); x1 = Math.max(x1, flat[i]);
      y0 = Math.min(y0, flat[i + 1]); y1 = Math.max(y1, flat[i + 1]);
      z0 = Math.min(z0, flat[i + 2]); z1 = Math.max(z1, flat[i + 2]);
    }
    return add({ ...o, kind: "hull", points: new Float32Array(flat), x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2, hz: (z1 - z0) / 2, yaw: 0 });
  }
  const listen = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const toLocal = (b, x, z, out) => {
    const dx = x - b.x, dz = z - b.z;
    out.lx = dx * b.cos - dz * b.sin; out.lz = dx * b.sin + dz * b.cos;
    return out;
  };
  const L = { lx: 0, lz: 0 };

  function topAt(b, lz) {
    if (b.kind !== "wedge") return b.y + b.hy;
    const s = Math.min(1, Math.max(0, (b.hz - lz) / (2 * b.hz)));
    return b.y - b.hy + 2 * b.hy * Math.pow(s, b.curve || 1.4);
  }

  // Highest walkable top under (x,z) not above yRef + step. Writes the surface normal into n.
  function groundAt(x, z, yRef, n) {
    const l = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let best = -Infinity, bb = null;
    if (!l) return best;
    for (let i = 0; i < l.length; i++) {
      const b = l[i];
      toLocal(b, x, z, L);
      if (Math.abs(L.lx) > b.hx || Math.abs(L.lz) > b.hz) continue;
      const t = topAt(b, L.lz);
      if (t > yRef + 0.9 || t <= best) continue;
      best = t; bb = b;
    }
    if (bb && n) {
      if (bb.kind === "wedge") {
        toLocal(bb, x, z, L);
        const s = Math.min(1, Math.max(0.02, (bb.hz - L.lz) / (2 * bb.hz))), c = bb.curve || 1.4;
        const slope = (2 * bb.hy * c * Math.pow(s, c - 1)) / (2 * bb.hz); // rise per metre toward -z
        const nlx = 0, nly = 1, nlz = slope;
        const wx = nlx * bb.cos + nlz * bb.sin, wz = -nlx * bb.sin + nlz * bb.cos;
        const inv = 1 / Math.hypot(wx, nly, wz);
        n.set(wx * inv, nly * inv, wz * inv);
      } else n.set(0, 1, 0);
      n.box = bb;
    }
    return best;
  }

  // Sphere vs boxes. cb(box, nx, ny, nz, depth) for each contact.
  function sphere(x, y, z, r, cb) {
    collect(x, z, r, (b) => {
      if (b.noCollide) return;
      toLocal(b, x, z, L);
      const qx = Math.max(-b.hx, Math.min(b.hx, L.lx)), qz = Math.max(-b.hz, Math.min(b.hz, L.lz));
      const top = topAt(b, qz);
      if (y > top - 0.25) return;
      const bottom = b.y - b.hy;
      const qy = Math.max(bottom, Math.min(top, y));
      const dx = L.lx - qx, dy = y - qy, dz = L.lz - qz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r * r) return;
      let nx, ny, nz, depth;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; depth = r - d;
      } else {
        const ex = b.hx - Math.abs(L.lx), ez = b.hz - Math.abs(L.lz);
        if (ex < ez) { nx = Math.sign(L.lx) || 1; ny = 0; nz = 0; depth = ex + r; } else { nx = 0; ny = 0; nz = Math.sign(L.lz) || 1; depth = ez + r; }
      }
      const wx = nx * b.cos + nz * b.sin, wz = -nx * b.sin + nz * b.cos;
      cb(b, wx, ny, wz, depth);
    });
  }

  function collect(x, z, r, fn) {
    stamp++;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const l = grid.get(key(i, j));
      if (!l) continue;
      for (let k = 0; k < l.length; k++) { const b = l[k]; if (b.mark === stamp) continue; b.mark = stamp; fn(b); }
    }
  }

  // Ray vs boxes (wedges treated as their bounding box). Returns {t, box} or null.
  const hit = { t: 0, box: null };
  function raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT, bb = null;
    const steps = Math.ceil(maxT / CELL) + 1;
    stamp++;
    for (let s = 0; s <= steps; s++) {
      const px = ox + dx * s * CELL, pz = oz + dz * s * CELL;
      const l = grid.get(key(Math.floor(px / CELL), Math.floor(pz / CELL)));
      if (!l) continue;
      for (let k = 0; k < l.length; k++) {
        const b = l[k];
        if (b.mark === stamp) continue;
        b.mark = stamp;
        if (b.noRay) continue;
        const t = rayBox(b, ox, oy, oz, dx, dy, dz, best);
        if (t < best) { best = t; bb = b; }
      }
      if (bb && best < s * CELL) break;
    }
    if (!bb) return null;
    hit.t = best; hit.box = bb;
    return hit;
  }
  function rayBox(b, ox, oy, oz, dx, dy, dz, maxT) {
    const rx = ox - b.x, rz = oz - b.z;
    const lox = rx * b.cos - rz * b.sin, loz = rx * b.sin + rz * b.cos, loy = oy - b.y;
    const ldx = dx * b.cos - dz * b.sin, ldz = dx * b.sin + dz * b.cos, ldy = dy;
    let t0 = 0, t1 = maxT;
    const slab = (o, d, h) => {
      if (Math.abs(d) < 1e-8) return o >= -h && o <= h;
      let a = (-h - o) / d, c = (h - o) / d;
      if (a > c) { const q = a; a = c; c = q; }
      if (a > t0) t0 = a; if (c < t1) t1 = c;
      return t0 <= t1;
    };
    if (!slab(lox, ldx, b.hx) || !slab(loy, ldy, b.hy) || !slab(loz, ldz, b.hz)) return Infinity;
    return t0;
  }

  return { add, addHull, remove, removeById, listen, groundAt, sphere, raycast, collect, topAt, all, byId };
}