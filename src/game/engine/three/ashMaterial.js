// Ground shading for the Ashmark: one material per biome mix. A tile's mask says which biomes it touches (1 city,
// 2 Spine, 4 dunes, 8 marsh; the wasteland is always in), so a pure dune tile compiles and samples only sand.
// PBR sets from the art pack, loaded at runtime (render/terrainLayers.js): city asphalt_damaged and concrete_cracked;
// Spine scree_gravel with pale_rock and red_rock; dunes sand_ripples; marsh cracked_mud and salt_flat, darker and
// glossier at the water line; wasteland salt_flat, gravel_dirt and sand_ripples. Slope puts triplanar strata rock on
// every cliff except dune faces. Far tiles and the horizon use the plain variant (no normal maps, one texture scale).
import * as THREE from "three";
import { TRIPLANAR } from "@/game/render/shaderlib";
import { onQuality } from "@/game/render/frame";
import { layerArrays, layerSize, GROUND_LAYERS, ROCK_LAYERS, STRATA_GLSL } from "@/game/render/terrainLayers";

const CITY_LAYERS = ["asphalt_damaged", "concrete_cracked"];
const VERT_DECL = "attribute vec4 bw;\nvarying vec4 vBW;\nvarying vec3 vTW;\nvarying vec3 vTN;";
const VERT_BODY = "vBW = bw;\nvTW = (modelMatrix * vec4(position, 1.0)).xyz;\nvTN = normalize(mat3(modelMatrix) * normal);";

const FRAG_DECL = /* glsl */`
uniform sampler2DArray tGC, tGN, tRC, tRN, tCC, tCN;
uniform sampler2D tNz;
varying vec4 vBW; varying vec3 vTW; varying vec3 vTN;
vec3 swTN = vec3(0.0, 1.0, 0.0);
float swTR = 0.95;
${TRIPLANAR}
${STRATA_GLSL}
const mat2 ASH_ROT = mat2(0.8, -0.6, 0.6, 0.8);
void ashLayer(sampler2DArray tc, sampler2DArray tnm, float L, vec2 p, float metres, float farMix, float w, inout vec3 col, inout vec3 tn) {
  if (w < 0.002) return;
  vec2 u = p / metres;
  vec3 c = texture(tc, vec3(u, L)).rgb;
#ifdef ASH_HQ
  vec3 cf = texture(tc, vec3(ASH_ROT * u * 0.27 + 0.37, L)).rgb;
  c = mix(c, cf * (dot(c, vec3(0.333)) / max(dot(cf, vec3(0.333)), 0.02)), farMix);
  tn += (texture(tnm, vec3(u, L)).xyz * 2.0 - 1.0) * w;
#endif
  col += c * w;
}`;

const FRAG_BODY = /* glsl */`
{
  vec3 Ng = normalize(vTN);
  vec3 P = vTW;
  float camD = distance(P, cameraPosition);
  float m1 = texture2D(tNz, P.xz * 0.0019).r;
  float m2 = texture2D(tNz, P.xz * 0.0085 + 0.31).g;
  float m3 = texture2D(tNz, P.xz * 0.045 + 0.57).b;
  float slope = 1.0 - Ng.y;
  float wCity = vBW.x;
  float wSpine = vBW.y;
  float wDune = vBW.z;
  float wMarsh = vBW.w;
  float wWaste = max(1.0 - wCity - wSpine - wDune - wMarsh, 0.0);
  float wRock = smoothstep(0.15, 0.32, slope + (m2 - 0.5) * 0.14) * (1.0 - 0.92 * wDune);
  float gnd = 1.0 - wRock;
  float farMix = 0.3 + 0.4 * smoothstep(15.0, 140.0, camD);
  vec3 gc = vec3(0.0);
  vec3 tn = vec3(0.0);
  float rough = 0.95;
  {
    float w = wWaste * gnd;
    float salt = smoothstep(0.42, 0.62, m1 * 0.7 + m2 * 0.3) * (1.0 - smoothstep(0.03, 0.09, slope));
    float grav = (1.0 - salt) * smoothstep(0.5, 0.7, m3 * 0.5 + m2 * 0.5);
    ashLayer(tGC, tGN, 2.0, P.xz, 4.0, farMix, w * salt, gc, tn);
    ashLayer(tGC, tGN, 3.0, P.xz, 4.0, farMix, w * grav, gc, tn);
    ashLayer(tGC, tGN, 0.0, P.xz, 4.0, farMix, w * (1.0 - salt - grav), gc, tn);
    rough -= 0.09 * w * salt;
  }
#ifdef ASH_CITY
  {
    float w = wCity * gnd;
    float conc = smoothstep(0.46, 0.54, m2 * 0.6 + m3 * 0.4);
    ashLayer(tCC, tCN, 0.0, P.xz, 3.0, farMix, w * (1.0 - conc), gc, tn);
    ashLayer(tCC, tCN, 1.0, P.xz, 2.0, farMix, w * conc, gc, tn);
    rough -= 0.08 * w * (1.0 - conc);
  }
#endif
#ifdef ASH_SPINE
  ashLayer(tGC, tGN, 4.0, P.xz, 3.0, farMix, wSpine * gnd, gc, tn);
#endif
#ifdef ASH_DUNES
  ashLayer(tGC, tGN, 0.0, P.xz, 4.0, farMix, wDune * gnd, gc, tn);
#endif
#ifdef ASH_MARSH
  {
    float w = wMarsh * gnd;
    float crust = smoothstep(0.15, 0.6, P.y + (m3 - 0.5) * 0.5);
    ashLayer(tGC, tGN, 2.0, P.xz, 4.0, farMix, w * crust, gc, tn);
    ashLayer(tGC, tGN, 1.0, P.xz, 2.2, farMix, w * (1.0 - crust), gc, tn);
    float wet = w * (1.0 - smoothstep(-0.2, 0.5, P.y));
    gc *= 1.0 - 0.45 * wet;
    rough -= 0.4 * wet;
  }
#endif
  vec3 rc = vec3(0.0);
  vec3 tpw = swTpW(Ng, 4.0);
  vec3 Pw = P;
  float pale = 0.0;
  float lip = 0.0;
  vec3 tint = vec3(1.0);
  vec3 shift = vec3(0.0);
  if (wRock > 0.002) {
    swStrata(P, m1, m2, pale, tint, lip, shift);
    Pw += shift;
    pale = max(pale, wSpine * 0.85);
    rc = mix(swTpA(tRC, Pw / 7.0, tpw, 0.0).rgb, swTpA(tRC, Pw / 6.0, tpw, 1.0).rgb, pale) * tint;
  }
  vec3 albedo = gc + rc * wRock;
  albedo *= mix(0.86, 1.08, m1) * mix(0.94, 1.05, m2);
  diffuseColor.rgb *= albedo;
  swTR = clamp(rough - wRock * 0.04, 0.3, 1.0);
#ifdef ASH_HQ
  float nk = mix(1.0, 0.35, smoothstep(40.0, 260.0, camD));
  tn = tn / max(gnd, 0.001);
  tn.xy *= nk;
  vec3 Tg = normalize(vec3(1.0, 0.0, 0.0) - Ng * Ng.x);
  vec3 Bg = normalize(vec3(0.0, 0.0, 1.0) - Ng * Ng.z);
  vec3 gN = normalize(Tg * tn.x + Bg * tn.y + Ng * max(tn.z, 0.2));
  vec3 rN = Ng;
  if (wRock > 0.002) rN = swTpNA(tRN, Pw / 7.0, Ng, tpw, 1.25 * nk, pale > 0.5 ? 1.0 : 0.0);
  swTN = normalize(mix(gN, rN, wRock));
#else
  swTN = Ng;
#endif
}`;

const BIT = { ASH_CITY: 1, ASH_SPINE: 2, ASH_DUNES: 4, ASH_MARSH: 8 };

/** T: the game's textures (T.noise). get(mask, fine) returns the shared material for that biome mix. */
export function createAshMaterials(T) {
  const size = layerSize();
  const G = layerArrays(GROUND_LAYERS, size), R = layerArrays(ROCK_LAYERS, size), C = layerArrays(CITY_LAYERS, size);
  const mats = new Map();
  let hq = true;
  function make(mask, fine) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    mat.defines = {};
    for (const k in BIT) if (mask & BIT[k]) mat.defines[k] = 1;
    if (fine && hq) mat.defines.ASH_HQ = 1;
    mat.userData.fine = fine;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { tGC: { value: G.color }, tGN: { value: G.normal }, tRC: { value: R.color }, tRN: { value: R.normal }, tCC: { value: C.color }, tCN: { value: C.normal }, tNz: { value: T.noise } });
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + VERT_DECL).replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERT_BODY);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + FRAG_DECL)
        .replace("#include <map_fragment>", FRAG_BODY)
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = swTR;")
        .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(swTN, 0.0)).xyz);");
    };
    mat.customProgramCacheKey = () => "ash-terrain-v1";
    return mat;
  }
  const off = onQuality((q) => {
    hq = q.terrain > 0;
    for (const m of mats.values()) {
      const want = m.userData.fine && hq;
      if (!!m.defines.ASH_HQ === want) continue;
      if (want) m.defines.ASH_HQ = 1; else delete m.defines.ASH_HQ;
      m.needsUpdate = true;
    }
  });
  return {
    get(mask, fine) {
      const key = mask * 2 + (fine ? 1 : 0);
      if (!mats.has(key)) mats.set(key, make(mask, fine));
      return mats.get(key);
    },
    count: () => mats.size,
    dispose() { off(); for (const m of mats.values()) m.dispose(); mats.clear(); },
  };
}