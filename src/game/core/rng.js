// Seeded randomness and 2D noise.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (r, a, b) => a + r() * (b - a);
export const irange = (r, a, b) => Math.floor(a + r() * (b - a + 1));
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Gradient noise in 2D, returns roughly [-1, 1].
export function makeNoise2D(seed = 1) {
  const r = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const g = (ix, iy, dx, dy) => { const h = perm[ix + perm[iy]]; return gx[h] * dx + gy[h] * dy; };
    const n00 = g(X, Y, xf, yf), n10 = g(X + 1, Y, xf - 1, yf);
    const n01 = g(X, Y + 1, xf, yf - 1), n11 = g(X + 1, Y + 1, xf - 1, yf - 1);
    const u = fade(xf), v = fade(yf);
    return 1.41 * ((n00 + u * (n10 - n00)) + v * ((n01 + u * (n11 - n01)) - (n00 + u * (n10 - n00))));
  };
}

export function fbm(noise, x, y, oct = 4, lac = 2, gain = 0.5) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Distance from point to a polyline of [x, z] pairs; returns {d, t (segment index + frac), side}.
export function distToPolyline(pts, x, z) {
  let best = Infinity, bi = 0, side = 1;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x, pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) { best = d; bi = i + t; side = Math.sign(dx * (z - az) - dz * (x - ax)) || 1; }
  }
  return { d: Math.sqrt(best), t: bi, side };
}