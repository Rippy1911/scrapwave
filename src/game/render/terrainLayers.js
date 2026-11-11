// Texture arrays for the ground and rock materials: every layer's colour in one sRGB array and its normal map in a
// linear one, so the terrain shader reads seven ground layers and two rock strata through four samplers (WebGL2 caps
// a fragment shader at 16 texture units). Mipmapped, anisotropic, filled with each layer's mean colour until the
// JPEGs (1k, or 512 px on the Low preset) arrive, then updated one layer at a time.
import * as THREE from "three";
import { ASSET_BASE, SETS } from "@/game/assets/assets";
import { RC } from "@/game/render/frame";

const MEAN = {
  scree_gravel: "#7a5643", dry_grass: "#a39276", red_cracked: "#8c5c44", pale_rock: "#a8987f",
  ...Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, v.mean])),
};
// Ground layer order is part of the shader (render/terrainMaterial.js).
export const GROUND_LAYERS = ["sand_ripples", "cracked_mud", "salt_flat", "gravel_dirt", "scree_gravel", "dry_grass", "red_cracked"];
export const ROCK_LAYERS = ["red_rock", "pale_rock"];

const cache = new Map();

function makeArray(size, n, fill, srgb) {
  const data = new Uint8Array(size * size * 4 * n);
  for (let l = 0; l < n; l++) {
    const [r, g, b] = fill(l), o = l * size * size * 4;
    for (let i = 0; i < size * size; i++) { data[o + i * 4] = r; data[o + i * 4 + 1] = g; data[o + i * 4 + 2] = b; data[o + i * 4 + 3] = 255; }
  }
  const t = new THREE.DataArrayTexture(data, size, size, n);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = RC.renderer ? Math.min(8, RC.renderer.capabilities.getMaxAnisotropy()) : 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

const rgb = (css) => { const c = new THREE.Color(css); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; };

function fillLayer(tex, layer, url, size) {
  if (typeof Image === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    tex.image.data.set(px, layer * size * size * 4);
    tex.addLayerUpdate(layer);
    tex.needsUpdate = true;
  };
  img.src = url;
}

/** { color, normal, size } arrays for a list of PBR set names (public/assets/textures/<name>/color.jpg, normal.jpg). */
export function layerArrays(names, size = 1024) {
  const key = names.join(",") + "@" + size;
  if (cache.has(key)) return cache.get(key);
  const color = makeArray(size, names.length, (l) => rgb(MEAN[names[l]] || "#9a8068"), true);
  const normal = makeArray(size, names.length, () => [128, 128, 255], false);
  names.forEach((n, l) => {
    fillLayer(color, l, `${ASSET_BASE}textures/${n}/color.jpg`, size);
    fillLayer(normal, l, `${ASSET_BASE}textures/${n}/normal.jpg`, size);
  });
  const out = { color, normal, size };
  cache.set(key, out);
  return out;
}

/** Layer size for the current preset: 512 px on Low (a quarter of the memory), 1k otherwise. Chosen once at start. */
export const layerSize = () => (RC.quality === "low" ? 512 : 1024);

// GLSL: triplanar strata rock from the rock arrays (layer 0 red sandstone, 1 pale band), world-space, shared by the
// terrain cliffs and every rock model so boulders and walls read as one formation. Needs swTpW from shaderlib.
export const STRATA_GLSL = /* glsl */`
vec4 swTpA(sampler2DArray t, vec3 p, vec3 w, float l) {
  vec4 c = vec4(0.0);
  if (w.x > 0.01) c += texture(t, vec3(p.zy, l)) * w.x;
  if (w.y > 0.01) c += texture(t, vec3(p.xz, l)) * w.y;
  if (w.z > 0.01) c += texture(t, vec3(p.xy, l)) * w.z;
  return c;
}
vec3 swTpNA(sampler2DArray t, vec3 p, vec3 n, vec3 w, float k, float l) {
  vec3 tx = texture(t, vec3(p.zy, l)).xyz * 2.0 - 1.0;
  vec3 ty = texture(t, vec3(p.xz, l)).xyz * 2.0 - 1.0;
  vec3 tz = texture(t, vec3(p.xy, l)).xyz * 2.0 - 1.0;
  tx.xy *= k; ty.xy *= k; tz.xy *= k;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
// Sedimentary bands: which stratum a world point is in (0 red .. 1 pale), its band tint and a ledge factor that is
// 1 just under each band's top edge (the lip that sticks out).
void swStrata(vec3 P, float m1, float m2, out float pale, out vec3 tint, out float lip, out vec3 shift) {
  float y = P.y + (m1 - 0.5) * 6.0 + (m2 - 0.5) * 2.5;
  float b = y / 3.1;
  float bi = floor(b), bf = fract(b);
  float h1 = fract(sin(bi * 12.9898) * 43758.5453), h2 = fract(sin(bi * 78.233 + 1.7) * 24634.6345);
  pale = step(0.68, h1) * smoothstep(0.0, 0.12, bf) * (1.0 - smoothstep(0.88, 1.0, bf));
  tint = mix(vec3(1.0), mix(vec3(0.86, 0.8, 0.76), vec3(1.1, 1.0, 0.9), h2), 0.8);
  tint *= mix(0.82, 1.0, smoothstep(0.0, 0.25, bf)); // darker undercut at the base of each band
  lip = smoothstep(0.78, 0.97, bf) * (1.0 - smoothstep(0.97, 1.0, bf));
  shift = vec3(h1 * 37.1, 0.0, h2 * 23.7); // each band samples its own part of the texture: no stacked repeats
}
`;
