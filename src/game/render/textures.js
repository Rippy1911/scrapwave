// Procedural tiling canvas textures generated at load. Every texture is seamless.
import * as THREE from "three";
import { mulberry32 } from "@/game/core/rng";

function tileNoise(seed, period) {
  const r = mulberry32(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (i, j) => g[((j % period + period) % period) * period + ((i % period + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function tfbm(seed, size, base, oct = 4) {
  const ns = [];
  for (let o = 0; o < oct; o++) ns.push(tileNoise(seed + o * 101, base << o));
  return (x, y) => {
    let s = 0, a = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { s += a * ns[o]((x / size) * (base << o), (y / size) * (base << o)); n += a; a *= 0.5; }
    return s / n;
  };
}

function canvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}
function paintPixels(c, fn) {
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(c.width, c.height);
  const d = img.data, s = c.width;
  const out = [0, 0, 0];
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    fn(x, y, out);
    const i = (y * s + x) * 4;
    d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let ANISO = 4;
export const setAnisotropy = (n) => { ANISO = Math.max(1, n || 1); };

function toTex(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = ANISO;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function scratches(ctx, s, r, n, color, w = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = w;
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s, a = r() * Math.PI, l = 4 + r() * 22;
    ctx.globalAlpha = 0.25 + r() * 0.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function rust(size = 256) {
  const c = canvas(size), n = tfbm(11, size, 4, 5), m = tfbm(23, size, 8, 3);
  const ctx = paintPixels(c, (x, y, o) => {
    const v = n(x, y), b = m(x, y);
    const t = sstep(0.42, 0.62, v);
    o[0] = mix(96, 150 + b * 60, t); o[1] = mix(92, 70 + b * 30, t); o[2] = mix(88, 36, t);
    const g = 0.8 + b * 0.4; o[0] *= g; o[1] *= g; o[2] *= g;
  });
  scratches(ctx, size, mulberry32(5), 70, "#c9c2b5");
  return c;
}

function paint(hex, size = 256, seed = 3) {
  // Sun-faded paint: broad fade, fine speckle, small chips to bare metal, a dust band at the bottom.
  const c = canvas(size), n = tfbm(seed, size, 4, 5), m = tfbm(seed + 7, size, 16, 2), f2 = tfbm(seed + 13, size, 2, 3);
  const [pr, pg, pb] = hexRgb(hex);
  const ctx = paintPixels(c, (x, y, o) => {
    const v = n(x, y), fade = 0.9 + f2(x, y) * 0.16, sp = 0.95 + m(x, y) * 0.1;
    const chip = sstep(0.74, 0.77, v);
    const edge = sstep(0.68, 0.74, v) * (1 - chip);
    const k = fade * sp;
    const lift = 0.1 * f2(x, y); // sun bleach toward pale
    o[0] = mix(mix(pr * k, 205, lift), 112, chip) * (1 - edge * 0.22);
    o[1] = mix(mix(pg * k, 190, lift), 84, chip) * (1 - edge * 0.26);
    o[2] = mix(mix(pb * k, 165, lift), 62, chip) * (1 - edge * 0.3);
  });
  scratches(ctx, size, mulberry32(seed + 1), 26, "#cfc8bc");
  const g = ctx.createLinearGradient(0, size * 0.72, 0, size);
  g.addColorStop(0, "rgba(150,118,80,0)"); g.addColorStop(1, "rgba(150,118,80,0.42)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}

// Tileable RGB value noise at three frequencies (linear data, not colour): macro variation and masks.
function noiseTex(size = 256) {
  const c = canvas(size), a = tfbm(211, size, 4, 4), b = tfbm(223, size, 8, 4), d = tfbm(227, size, 16, 3);
  paintPixels(c, (x, y, o) => { o[0] = a(x, y) * 255; o[1] = b(x, y) * 255; o[2] = d(x, y) * 255; });
  return c;
}

function hazard(size = 128) {
  const c = canvas(size), ctx = c.getContext("2d");
  ctx.fillStyle = "#1c1a17"; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#e3b21f";
  for (let i = -2; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * size / 2, 0); ctx.lineTo(i * size / 2 + size / 4, 0);
    ctx.lineTo(i * size / 2 + size / 4 + size, size); ctx.lineTo(i * size / 2 + size, size); ctx.fill();
  }
  const n = tfbm(41, size, 4, 3), img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4, v = n(p % size, Math.floor(p / size));
    if (v > 0.6) { img.data[i] = 120; img.data[i + 1] = 60; img.data[i + 2] = 30; }
    else { const f = 0.75 + v * 0.4; img.data[i] *= f; img.data[i + 1] *= f; img.data[i + 2] *= f; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function corrugated(size = 256) {
  const c = canvas(size), n = tfbm(53, size, 4, 4);
  return paintPixels(c, (x, y, o) => {
    const ridge = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 16);
    const rv = sstep(0.45, 0.7, n(x, y) + (y / size) * 0.15);
    const base = 110 + ridge * 70;
    o[0] = mix(base, 150, rv); o[1] = mix(base * 0.96, 72, rv); o[2] = mix(base * 0.9, 38, rv);
  }), c;
}

function asphalt(size = 256) {
  const c = canvas(size), n = tfbm(61, size, 16, 4), w = tfbm(67, size, 4, 3);
  const ctx = paintPixels(c, (x, y, o) => {
    const v = 40 + n(x, y) * 40 + w(x, y) * 30;
    const u = x / size;
    const track = Math.exp(-((u - 0.3) ** 2) / 0.004) + Math.exp(-((u - 0.7) ** 2) / 0.004);
    const g = v * (1 - track * 0.25);
    o[0] = g * 1.05; o[1] = g; o[2] = g * 0.95;
  });
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#c9a43a";
  ctx.fillRect(size * 0.48, 0, size * 0.04, size * 0.55);
  ctx.fillStyle = "#cfc7b6";
  ctx.fillRect(size * 0.04, 0, size * 0.02, size); ctx.fillRect(size * 0.94, 0, size * 0.02, size);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(15,12,10,0.8)"; ctx.lineWidth = 1.2;
  const r = mulberry32(9);
  for (let i = 0; i < 18; i++) {
    let x = r() * size, y = r() * size; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return c;
}

function ground(size, seed, colA, colB, opts = {}) {
  const c = canvas(size), n = tfbm(seed, size, 4, 5), m = tfbm(seed + 5, size, 16, 3);
  const A = hexRgb(colA), B = hexRgb(colB);
  const ctx = paintPixels(c, (x, y, o) => {
    let v = n(x, y) * 0.7 + m(x, y) * 0.3;
    if (opts.ripples) v = v * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((y / size) * Math.PI * 2 * 10 + n(x, y) * 8));
    if (opts.strata) v = v * 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((y / size) * Math.PI * 2 * 6 + m(x, y) * 3));
    o[0] = mix(A[0], B[0], v); o[1] = mix(A[1], B[1], v); o[2] = mix(A[2], B[2], v);
  });
  if (opts.cracks) {
    ctx.strokeStyle = opts.cracks; ctx.lineWidth = 1.4;
    const r = mulberry32(seed + 3);
    for (let i = 0; i < 60; i++) {
      let x = r() * size, y = r() * size; ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.5; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  return c;
}

function planks(size = 128) {
  const c = canvas(size), n = tfbm(71, size, 2, 4);
  return paintPixels(c, (x, y, o) => {
    const band = Math.floor((y / size) * 6), gap = (y % (size / 6)) < 2 ? 0.4 : 1;
    const grain = 0.5 + 0.5 * Math.sin(x * 0.25 + n(x, y + band * 40) * 12);
    const v = (0.7 + grain * 0.3) * gap * (0.85 + (band % 3) * 0.06);
    o[0] = 120 * v; o[1] = 84 * v; o[2] = 52 * v;
  }), c;
}

function concrete(size = 256) {
  const c = canvas(size), n = tfbm(83, size, 8, 5), m = tfbm(89, size, 2, 3);
  return paintPixels(c, (x, y, o) => {
    const v = 140 + n(x, y) * 50 - sstep(0.5, 0.8, m(x, y)) * 45;
    o[0] = v * 1.02; o[1] = v * 0.98; o[2] = v * 0.92;
  }), c;
}

function rail(size = 256) {
  const c = ground(size, 97, "#5a4f45", "#8a7b6a"), ctx = c.getContext("2d");
  ctx.fillStyle = "#3b2c20";
  for (let i = 0; i < 8; i++) ctx.fillRect(size * 0.12, i * size / 8 + 4, size * 0.76, size / 18);
  ctx.fillStyle = "#6e6a66";
  ctx.fillRect(size * 0.27, 0, size * 0.04, size); ctx.fillRect(size * 0.69, 0, size * 0.04, size);
  return c;
}

function dirt(size = 256) {
  const c = ground(size, 101, "#7f6040", "#a98a62"), ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, size, 0);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.28, "rgba(40,25,10,0.35)"); g.addColorStop(0.35, "rgba(0,0,0,0)");
  g.addColorStop(0.65, "rgba(0,0,0,0)"); g.addColorStop(0.72, "rgba(40,25,10,0.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}

// Fine greyscale detail noise (multiplied over close surfaces) — linear, not sRGB.
function detail(size = 256) {
  const c = canvas(size), n = tfbm(141, size, 16, 3), m = tfbm(149, size, 64, 1);
  paintPixels(c, (x, y, o) => { const v = 128 + (n(x, y) - 0.5) * 120 + (m(x, y) - 0.5) * 70; o[0] = o[1] = o[2] = v; });
  return c;
}

// Ground detail: sand ripples, gravel and hairline cracks (greyscale, blended near the camera).
function groundDetail(size = 512) {
  const c = canvas(size), n = tfbm(157, size, 8, 4), g = tfbm(163, size, 128, 1);
  const ctx = paintPixels(c, (x, y, o) => {
    const ripple = 0.5 + 0.5 * Math.sin((y / size) * Math.PI * 2 * 14 + n(x, y) * 9);
    const grit = g(x, y) > 0.72 ? -55 : g(x, y) < 0.2 ? 30 : 0;
    const v = 128 + (ripple - 0.5) * 50 + (n(x, y) - 0.5) * 60 + grit;
    o[0] = o[1] = o[2] = v;
  });
  ctx.strokeStyle = "rgba(40,40,40,0.55)"; ctx.lineWidth = 1.5;
  const r = mulberry32(171);
  for (let i = 0; i < 40; i++) {
    let x = r() * size, y = r() * size; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(60,55,50,0.6)";
  for (let i = 0; i < 400; i++) { const s = 1 + r() * 3; ctx.fillRect(r() * size, r() * size, s, s); }
  return c;
}

export function createTextures() {
  const cache = new Map();
  const T = {
    rust: toTex(rust(512)),
    hazard: toTex(hazard(256)),
    corrugated: toTex(corrugated(512)),
    asphalt: toTex(asphalt(512)),
    rail: toTex(rail(512)),
    dirt: toTex(dirt(512)),
    sand: toTex(ground(512, 113, "#b88a5c", "#dcb487", { ripples: true })),
    salt: toTex(ground(512, 127, "#cfc3ad", "#ece4d2", { cracks: "#8f7f68" })),
    rock: toTex(ground(512, 131, "#7d3f22", "#c0703f", { strata: true })),
    concrete: toTex(concrete(512)),
    wood: toTex(planks(256)),
    detail: toTex(detail(256), 1, false),
    groundDetail: toTex(groundDetail(512), 1, false),
    noise: toTex(noiseTex(256), 1, false),
    paint(hex) {
      if (!cache.has(hex)) cache.set(hex, toTex(paint(hex, 256, (parseInt(hex.slice(1), 16) % 97) + 3)));
      return cache.get(hex);
    },
    paintCanvas: (hex) => paint(hex, 256, (parseInt(hex.slice(1), 16) % 97) + 3),
  };
  return T;
}
export { toTex, canvas };