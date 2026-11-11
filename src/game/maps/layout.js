// World-map layouts as plain data (round 15). A map file writes its plan with these helpers and returns L; the
// loader (maps/loader.js) builds it on the deck, the map cards and the minimap (maps/drawLayout.js) draw it.
// Units are metres from the map centre, y up from the deck floor. r turns a piece about y. A ramp rises toward its
// local -z: at polar angle a, r = a + PI rises outward, r = a rises inward, r = a - PI/2 rises along +a.
// Materials are game material keys ("rock", "concrete", "rust", ...) or "#rrggbb" paint.
export const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

export function createLayout(o = {}) {
  const L = { R: 160, floor: "sand", outer: null, wall: "concrete", horizon: "rock", tint: "#8a7356", sky: null, landmark: null, ...o,
    pieces: [], spawns: [], checkpoints: [], power: [], horde: [], props: [] };
  const put = (p) => { L.pieces.push(p); return p; };
  // A local offset (lx, lz) in a frame at (x, z) turned by r, the same turn the place kit uses.
  const at = (x, z, r, lx, lz) => { const c = Math.cos(r), s = Math.sin(r); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
  const polar = (a, r) => [Math.sin(a) * r, Math.cos(a) * r];
  const pt = (deg, r, y = 0) => { const [x, z] = polar(deg * D2R, r); return { x, z, y }; };

  const B = {
    L, at, polar, pt,
    solid: (m, x, z, w, h, d, r = 0, y = 0, e = {}) => put({ t: "solid", m, x, z, y, w, h, d, r, ...e }),
    deco: (m, x, z, w, h, d, r = 0, y = 0, e = {}) => put({ t: "deco", m, x, z, y, w, h, d, r, ...e }),
    post: (m, x, z, rad, h, y = 0, solid = true) => put({ t: "cyl", m, x, z, y, w: rad * 2, h, d: rad * 2, r: 0, solid }),
    // A looks-only disc (wheel, tank) of radius rad and thickness th; e.rz = PI / 2 stands it up facing x.
    disc: (m, x, z, rad, th, y = 0, e = {}) => put({ t: "cyl", m, x, z, y, w: rad * 2, h: th, d: rad * 2, r: 0, solid: false, ...e }),
    ramp: (x, z, w, len, h, r = 0, e = {}) => put({ t: "ramp", m: e.m || "wood", x, z, y: e.y || 0, w, h, d: len, r, curve: e.curve || 1 }),
    lamp: (x, z, y, size = 1.4, m = "redLight") => put({ t: "lamp", m, x, z, y, w: size, h: size, d: size, r: 0 }),
    // n segments of a ring at radius r between angles a0 and a1 (radians): fn(a, x, z, segmentLength, i).
    ring(n, r, fn, a0 = 0, a1 = TAU) {
      for (let i = 0; i < n; i++) { const a = a0 + ((i + 0.5) / n) * (a1 - a0), [x, z] = polar(a, r); fn(a, x, z, (r * (a1 - a0)) / n, i); }
    },
    // A solid band (terrace, rim, bank) from radius r0 to r1 between angles a0 and a1; skip(a) leaves gaps.
    band(m, r0, r1, h, a0, a1, n, skip = null, y = 0) {
      B.ring(n, (r0 + r1) / 2, (a, x, z, w) => { if (!skip || !skip(a)) B.solid(m, x, z, w + 0.7, h, r1 - r0, a, y); }, a0, a1);
    },
    // A flat platform with ramps up on some sides ("n" its -z side, "s" +z, "e" +x, "w" -x).
    mesa(m, x, z, w, d, h, r = 0, sides = "", e = {}) {
      const y = e.y || 0, len = e.len || Math.max(9, h * 3.2), rw = e.rw || 9;
      B.solid(m, x, z, w, h, d, r, y);
      const S = { n: [0, -(d + len) / 2, Math.PI], s: [0, (d + len) / 2, 0], e: [(w + len) / 2, 0, Math.PI / 2], w: [-(w + len) / 2, 0, -Math.PI / 2] };
      for (const k of sides) { const [lx, lz, ry] = S[k], [px, pz] = at(x, z, r, lx, lz); B.ramp(px, pz, rw, len, h, r + ry, { m: e.rm, y }); }
    },
    spawn: (x, z, y = 0) => L.spawns.push({ x, z, y }),
    cp: (x, z, y = 0) => L.checkpoints.push({ x, z, y }),
    power: (x, z, y = 0) => L.power.push({ x, z, y }),
    horde: (x, z, y = 0) => L.horde.push({ x, z, y }),
    // Breakable props (arena/breakables.js kinds): barrel, crate, fence, pole, sign.
    prop: (kind, x, z, ry = 0, y = 0) => L.props.push({ kind, x, z, y, ry }),
    done: () => L,
  };
  return B;
}