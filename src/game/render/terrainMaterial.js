// Terrain shading: seven CC0 ground layers (sand ripples, cracked mud, salt flat, gravel, scree rubble, withered grass,
// red cracked earth) in one texture array, blended by the salt/mesa splat, the scree apron at the foot of cliffs,
// slope, height, road shoulders and three octaves of world noise. Cliffs are triplanar strata rock (red sandstone
// with pale bands, darker undercuts and lit ledge lips) from the rock array that the rock models share. Ground layers
// are sampled at two scales and rotated so tiling does not show at distance.
import * as THREE from "three";
import { TRIPLANAR } from "@/game/render/shaderlib";
import { onQuality } from "@/game/render/frame";
import { layerArrays, layerSize, GROUND_LAYERS, ROCK_LAYERS, STRATA_GLSL } from "@/game/render/terrainLayers";

export function createTerrainMaterial(T) {
  const size = layerSize();
  const G = layerArrays(GROUND_LAYERS, size), R = layerArrays(ROCK_LAYERS, size);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.defines = { SW_HQ: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tGC = { value: G.color }; sh.uniforms.tGN = { value: G.normal };
    sh.uniforms.tRC = { value: R.color }; sh.uniforms.tRN = { value: R.normal };
    sh.uniforms.tNz = { value: T.noise };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 splat;\nattribute vec2 look;\nattribute float roadW;\nvarying vec2 vSplat;\nvarying vec2 vLook;\nvarying float vRoad;\nvarying vec3 vTW;\nvarying vec3 vTN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSplat = splat; vLook = look; vRoad = roadW;\nvTW = (modelMatrix * vec4(position, 1.0)).xyz;\nvTN = normalize(mat3(modelMatrix) * normal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2DArray tGC, tGN, tRC, tRN;
uniform sampler2D tNz;
varying vec2 vSplat; varying vec2 vLook; varying float vRoad; varying vec3 vTW; varying vec3 vTN;
vec3 swTN = vec3(0.0, 1.0, 0.0);
float swTR = 0.95;
${TRIPLANAR}
${STRATA_GLSL}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
// Two-scale colour (near tile + rotated far tile) and a near-scale tangent normal for one ground layer.
void layer(float L, vec2 p, float metres, float farMix, float w, inout vec3 col, inout vec3 tn) {
  if (w < 0.002) return;
  vec2 u = p / metres;
  vec3 c = texture(tGC, vec3(u, L)).rgb;
#ifdef SW_HQ
  vec3 cf = texture(tGC, vec3(ROT * u * 0.27 + 0.37, L)).rgb;
  c = mix(c, cf * (dot(c, vec3(0.333)) / max(dot(cf, vec3(0.333)), 0.02)), farMix);
  tn += (texture(tGN, vec3(u, L)).xyz * 2.0 - 1.0) * w;
#endif
  col += c * w;
}`)
      .replace("#include <map_fragment>", `
{
  vec3 Ng = normalize(vTN);
  vec3 P = vTW;
  float camD = distance(P, cameraPosition);
  float m1 = texture2D(tNz, P.xz * 0.0019).r;
  float m2 = texture2D(tNz, P.xz * 0.0085 + 0.31).g;
  float m3 = texture2D(tNz, P.xz * 0.045 + 0.57).b;
  float slope = 1.0 - Ng.y;

  // --- weights
  float rockSteep = smoothstep(0.17, 0.36, slope + (m2 - 0.5) * 0.16);
  rockSteep = max(rockSteep, vLook.y * smoothstep(0.08, 0.2, slope));
  float capRock = vSplat.y * (1.0 - rockSteep) * smoothstep(0.45, 0.7, m3 * 0.6 + m2 * 0.4) * 0.7;
  float wRock = clamp(rockSteep + capRock, 0.0, 1.0);
  float r1 = 1.0 - wRock;
  float saltA = clamp(vSplat.x * 1.15, 0.0, 1.0) * r1;
  float mudInSalt = smoothstep(0.4, 0.6, m2 * 0.65 + m3 * 0.35) * (1.0 - smoothstep(0.85, 1.0, vSplat.x) * 0.5);
  float wMud = saltA * mudInSalt;
  float wSalt = saltA - wMud;
  float r2 = r1 - saltA;
  // scree rubble on the apron under every cliff, thinning out with distance from the wall
  float scr = clamp(vLook.x * 1.3 + smoothstep(0.1, 0.24, slope) * 0.3 + (m3 - 0.5) * 0.3, 0.0, 1.0) * (1.0 - vRoad);
  float wScree = r2 * scr;
  float r3 = r2 - wScree;
  float basin = (1.0 - smoothstep(4.0, 8.0, P.y)) * (1.0 - smoothstep(0.02, 0.07, slope)) * smoothstep(0.55, 0.72, m2 + m3 * 0.2);
  float gravK = clamp(smoothstep(0.05, 0.17, slope) + vSplat.y * 0.8 + vRoad * 0.9 + smoothstep(0.6, 0.78, m3 * 0.55 + m1 * 0.45) * 0.75, 0.0, 1.0);
  float wB = r3 * basin * (1.0 - gravK);
  float wCrk = wB * smoothstep(0.42, 0.58, m1 + (m3 - 0.5) * 0.2);
  float wMud2 = wB - wCrk;
  float wGrav = (r3 - wB) * gravK;
  float rest = max(r3 - wB - wGrav, 0.0);
  // withered grass in patches on the open sand, never on the road shoulders
  float gp = smoothstep(0.5, 0.64, m2 * 0.62 + m3 * 0.38) * (1.0 - vRoad);
  float wGrass = rest * gp * 0.9;
  float wSand = rest - wGrass;
  wMud += wMud2;

  // --- ground layers (indices follow GROUND_LAYERS)
  float farMix = 0.3 + 0.4 * smoothstep(15.0, 140.0, camD);
  vec3 gc = vec3(0.0), tn = vec3(0.0);
  layer(0.0, P.xz, 4.0, farMix, wSand, gc, tn);
  layer(1.0, P.xz, 2.2, farMix, wMud, gc, tn);
  layer(2.0, P.xz, 4.0, farMix, wSalt, gc, tn);
  layer(3.0, P.xz, 4.0, farMix, wGrav, gc, tn);
  layer(4.0, P.xz, 3.0, farMix, wScree, gc, tn);
  layer(5.0, P.xz, 2.6, farMix, wGrass, gc, tn);
  layer(6.0, P.xz, 3.2, farMix, wCrk, gc, tn);
  gc += gc * wCrk * 0.12; // lift the red cracked earth a little: it read as dark stains from the air

  // --- triplanar strata rock (mesa walls, buttes, canyon, caprock)
  vec3 rc = vec3(0.0);
  vec3 tpw = swTpW(Ng, 4.0);
  vec3 Pw = P + vec3(0.0, (m2 - 0.5) * 5.0 + (m1 - 0.5) * 8.0, 0.0);
  float pale = 0.0, lip = 0.0; vec3 tint = vec3(1.0), shift = vec3(0.0);
  if (wRock > 0.002) {
    swStrata(P, m1, m2, pale, tint, lip, shift);
    Pw += shift;
    rc = swTpA(tRC, Pw / 7.0, tpw, 0.0).rgb;
    if (pale > 0.01) rc = mix(rc, swTpA(tRC, Pw / 6.0, tpw, 1.0).rgb * vec3(1.08, 0.98, 0.9), pale);
#ifdef SW_HQ
    vec3 rf = swTpA(tRC, vec3(Pw.z * 0.6, Pw.y, -Pw.x * 0.6) / 19.0 + 0.5, tpw, 0.0).rgb;
    rc = mix(rc, rf * (dot(rc, vec3(0.333)) / max(dot(rf, vec3(0.333)), 0.02)), 0.4);
    rc = mix(vec3(dot(rc, vec3(0.333))), rc, 1.1);
#endif
    rc *= vec3(1.08, 0.94, 0.86) * tint;
  }
  vec3 albedo = gc + rc * wRock;
  // colour cohesion: warm the sand, keep salt a little cream, macro brightness variation
  albedo *= mix(vec3(1.0), vec3(1.06, 0.98, 0.9), wSand);
  albedo *= mix(0.84, 1.1, m1) * mix(0.93, 1.06, m2);
  albedo = mix(albedo, albedo * vec3(0.92, 0.9, 0.88), vRoad * 0.5);
  diffuseColor.rgb *= albedo;
  swTR = mix(0.97, 0.86, wSalt) - wRock * 0.04;

#ifdef SW_HQ
  float nk = mix(1.0, 0.35, smoothstep(40.0, 260.0, camD));
  float gsum = max(1.0 - wRock, 1e-3);
  tn = tn / gsum; tn.xy *= nk;
  vec3 Tg = normalize(vec3(1.0, 0.0, 0.0) - Ng * Ng.x), Bg = normalize(vec3(0.0, 0.0, 1.0) - Ng * Ng.z);
  vec3 gN = normalize(Tg * tn.x + Bg * tn.y + Ng * max(tn.z, 0.2));
  vec3 rN = Ng;
  if (wRock > 0.002) {
    rN = swTpNA(tRN, Pw / 7.0, Ng, tpw, 1.25 * nk, pale > 0.5 ? 1.0 : 0.0);
    rN = normalize(rN + vec3(0.0, lip * 0.7 * (1.0 - Ng.y), 0.0));
  }
  swTN = normalize(mix(gN, rN, wRock));
#else
  swTN = Ng;
#endif
}`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = swTR;")
      .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(swTN, 0.0)).xyz);");
  };
  mat.customProgramCacheKey = () => "sw-terrain-v3";
  onQuality((q) => {
    const hq = q.terrain > 0;
    if (!!mat.defines.SW_HQ !== hq) { if (hq) mat.defines.SW_HQ = 1; else delete mat.defines.SW_HQ; mat.needsUpdate = true; }
  });
  return mat;
}

// Shadow caster for the terrain, sunk 0.6 m: mesas and dunes still throw shadows, but the ground never shadows the
// road ribbons lying a few centimetres above it or itself on gentle slopes.
export function terrainShadowDepth() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y -= 0.6;"); };
  m.customProgramCacheKey = () => "sw-terrain-depth";
  return m;
}
