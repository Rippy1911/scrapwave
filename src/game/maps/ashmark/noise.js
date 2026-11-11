// Seeded 2D gradient noise for the Ashmark height function. No closures and no allocations per call: the tile
// builder calls it tens of thousands of times a second. noise() returns about -1..1.
import { mulberry32 } from "@/game/core/rng";

export function makeNoise(seed) {
  const r = mulberry32(seed), p = new Uint8Array(256), perm = new Uint8Array(512);
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }

  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = perm[X + perm[Y]], b = perm[X + 1 + perm[Y]], c = perm[X + perm[Y + 1]], d = perm[X + 1 + perm[Y + 1]];
    const n00 = gx[a] * xf + gy[a] * yf, n10 = gx[b] * (xf - 1) + gy[b] * yf;
    const n01 = gx[c] * xf + gy[c] * (yf - 1), n11 = gx[d] * (xf - 1) + gy[d] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const lo = n00 + u * (n10 - n00), hi = n01 + u * (n11 - n01);
    return 1.41 * (lo + v * (hi - lo));
  }
  // Fractal sum, about -1..1.
  function fbm(x, y, oct) {
    let s = 0, a = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x, y); n += a; a *= 0.5; x *= 2; y *= 2; }
    return s / n;
  }
  // Ridged sum, 0..1: sharp crests and round valleys (the Spine).
  function ridged(x, y, oct) {
    let s = 0, a = 1, n = 0;
    for (let i = 0; i < oct; i++) { const q = 1 - Math.abs(noise(x, y)); s += a * q * q; n += a; a *= 0.5; x *= 2.03; y *= 2.03; }
    return s / n;
  }
  return { noise, fbm, ridged };
}