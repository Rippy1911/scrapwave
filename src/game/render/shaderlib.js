// GLSL snippets and onBeforeCompile helpers shared by the terrain, building kit, props and vehicle materials.
import * as THREE from "three";

// World position + normal varyings (instancing aware). Injected after <worldpos_vertex>.
export const WORLD_VARYINGS = "varying vec3 vSwW;\nvarying vec3 vSwN;\n";
export const WORLD_VERTEX = `
{
  vec4 swW4 = vec4(transformed, 1.0);
  vec3 swN = objectNormal;
  #ifdef USE_INSTANCING
  swW4 = instanceMatrix * swW4; swN = mat3(instanceMatrix) * swN;
  #endif
  vSwW = (modelMatrix * swW4).xyz;
  vSwN = normalize(mat3(modelMatrix) * swN);
}`;

// Object-space position + normal (for vehicles: patterns stick to the part) and the object-to-view basis.
export const OBJECT_VARYINGS = "varying vec3 vSwO;\nvarying vec3 vSwON;\nvarying mat3 vSwToView;\n";
export const OBJECT_VERTEX = `
{
  vSwO = position;
  vSwON = objectNormal;
  mat3 swInst = mat3(1.0);
  #ifdef USE_INSTANCING
  swInst = mat3(instanceMatrix);
  #endif
  vSwToView = normalMatrix * swInst;
}`;

export const TRIPLANAR = `
vec3 swTpW(vec3 n, float k) { vec3 w = pow(abs(n), vec3(k)); return w / max(w.x + w.y + w.z, 1e-4); }
vec4 swTp(sampler2D t, vec3 p, vec3 w) {
  vec4 c = vec4(0.0);
  if (w.x > 0.01) c += texture2D(t, p.zy) * w.x;
  if (w.y > 0.01) c += texture2D(t, p.xz) * w.y;
  if (w.z > 0.01) c += texture2D(t, p.xy) * w.z;
  return c;
}
// Whiteout-blended triplanar normal map (Ben Golus); n is the surface normal in the same space as p.
vec3 swTpN(sampler2D t, vec3 p, vec3 n, vec3 w, float k) {
  vec3 tx = texture2D(t, p.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(t, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(t, p.xy).xyz * 2.0 - 1.0;
  tx.xy *= k; ty.xy *= k; tz.xy *= k;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
float swLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/** Chain an onBeforeCompile patch onto a material (several patches can stack). */
export function patch(mat, key, fn) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.call(mat) : "";
  mat.onBeforeCompile = (sh, r) => { if (prev) prev.call(mat, sh, r); fn(sh, r); };
  mat.customProgramCacheKey = () => prevKey + "|" + key;
  return mat;
}

export const vtx = (sh, decl, body, after = "#include <worldpos_vertex>") => {
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + decl).replace(after, after + "\n" + body);
};
export const frag = (sh, decl) => { sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + decl); };

/** World-space grime: low-frequency tint so repeated textures and identical props never look stamped. */
export function addGrime(mat, noiseTex, amount = 0.22, streaks = 0.18) {
  return patch(mat, `grime${amount}${streaks}`, (sh) => {
    sh.uniforms.tSwNoise = { value: noiseTex };
    vtx(sh, WORLD_VARYINGS, WORLD_VERTEX);
    frag(sh, WORLD_VARYINGS + "uniform sampler2D tSwNoise;\n");
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 gN = normalize(vSwN);
  float g1 = texture2D(tSwNoise, vSwW.xz * 0.031 + vSwW.y * 0.017).r;
  float g2 = texture2D(tSwNoise, vec2(vSwW.x + vSwW.z, vSwW.y * 0.08) * 0.21).g;
  float vert = 1.0 - abs(gN.y);
  diffuseColor.rgb *= mix(1.0 - ${amount.toFixed(3)}, 1.0 + ${(amount * 0.6).toFixed(3)}, g1);
  diffuseColor.rgb *= 1.0 - ${streaks.toFixed(3)} * vert * smoothstep(0.45, 0.85, g2);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 0.98, 0.86), smoothstep(0.6, 1.0, gN.y) * 0.5);
}`);
  });
}

/** Paint mask on a chipped-paint texture: the light, unsaturated texels take the paint colour, chips keep metal. */
export function addPaintTint(mat, hex) {
  const col = new THREE.Color(hex);
  return patch(mat, "tint", (sh) => {
    sh.uniforms.uSwPaint = { value: col };
    frag(sh, "uniform vec3 uSwPaint;\n");
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 t = diffuseColor.rgb;
  float l = dot(t, vec3(0.2126, 0.7152, 0.0722));
  float sat = max(t.r, max(t.g, t.b)) - min(t.r, min(t.g, t.b));
  float m = smoothstep(0.16, 0.34, l) * (1.0 - smoothstep(0.06, 0.16, sat));
  diffuseColor.rgb = mix(t * vec3(0.9, 0.82, 0.74), uSwPaint * (0.62 + 0.55 * l), m);
}`);
  });
}
