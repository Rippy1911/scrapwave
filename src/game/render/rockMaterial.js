// One shared material for every geometry-only rock model (cliff chunks, boulders, scree, stones): world-space
// triplanar strata from the same rock arrays as the terrain cliffs, so a boulder at the foot of a mesa reads as a piece
// of that mesa. Wind-blown sand settles on the up-facing parts. Instancing-aware.
import * as THREE from "three";
import { TRIPLANAR } from "@/game/render/shaderlib";
import { layerArrays, layerSize, ROCK_LAYERS, STRATA_GLSL } from "@/game/render/terrainLayers";

let shared = null;
export function rockMaterial(T) {
  if (shared) return shared;
  const R = layerArrays(ROCK_LAYERS, layerSize());
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.93, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tRC = { value: R.color }; sh.uniforms.tRN = { value: R.normal }; sh.uniforms.tNz = { value: T.noise };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRW;\nvarying vec3 vRN;")
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
{
  vec4 w4 = vec4(transformed, 1.0);
  vec3 n = objectNormal;
  #ifdef USE_INSTANCING
  mat3 im = mat3(instanceMatrix);
  w4 = instanceMatrix * w4;
  n = im * (n / vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2])));
  #endif
  vRW = (modelMatrix * w4).xyz;
  vRN = normalize(mat3(modelMatrix) * n);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2DArray tRC, tRN;
uniform sampler2D tNz;
varying vec3 vRW; varying vec3 vRN;
vec3 swRN = vec3(0.0, 1.0, 0.0);
${TRIPLANAR}
${STRATA_GLSL}`)
      .replace("#include <map_fragment>", `
{
  vec3 Ng = normalize(vRN);
  vec3 P = vRW;
  float m1 = texture2D(tNz, P.xz * 0.0019).r;
  float m2 = texture2D(tNz, P.xz * 0.0085 + 0.31).g;
  float m3 = texture2D(tNz, P.xz * 0.045 + 0.57).b;
  vec3 tpw = swTpW(Ng, 4.0);
  vec3 Pw = P + vec3(0.0, (m2 - 0.5) * 5.0 + (m1 - 0.5) * 8.0, 0.0);
  float pale, lip; vec3 tint, shift;
  swStrata(P, m1, m2, pale, tint, lip, shift);
    Pw += shift;
  vec3 rc = swTpA(tRC, Pw / 4.0, tpw, 0.0).rgb;
  if (pale > 0.01) rc = mix(rc, swTpA(tRC, Pw / 3.5, tpw, 1.0).rgb * vec3(1.08, 0.98, 0.9), pale);
  rc *= vec3(1.08, 0.94, 0.86) * mix(vec3(1.0), tint, 0.6) * mix(0.86, 1.1, m3);
  // sand on the tops
  float dust = smoothstep(0.55, 0.9, Ng.y) * smoothstep(0.3, 0.7, m3 + 0.25);
  rc = mix(rc, vec3(0.62, 0.47, 0.33), dust * 0.55);
  diffuseColor.rgb *= rc;
  vec3 rN = swTpNA(tRN, Pw / 4.0, Ng, tpw, 1.35, pale > 0.5 ? 1.0 : 0.0);
  swRN = normalize(mix(rN, Ng, dust * 0.6));
}`)
      .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(swRN, 0.0)).xyz);");
  };
  mat.customProgramCacheKey = () => "sw-rock-v1";
  shared = mat;
  return mat;
}
