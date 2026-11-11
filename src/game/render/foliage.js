// Wind sway for grass, brush and dead branches: the top of each instance leans downwind and flutters, the base stays
// put (bend grows with the square of the height above the instance origin). Reads the shared wind (render/wind.js),
// so grass, dust and smoke all lean the same way. One uniform set for every swaying material.
import * as THREE from "three";
import { onFrame } from "@/game/render/frame";
import { WIND } from "@/game/render/wind";

export const SWAY = { uTime: { value: 0 }, uWind: { value: new THREE.Vector3(0.94, 0, 0.35) } };
let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  onFrame((cam, dt, time) => {
    SWAY.uTime.value = time;
    SWAY.uWind.value.set(WIND.x, Math.min(2, WIND.speed / 4), WIND.z); // y carries the strength
  });
}

/** Patch a material (instanced) to sway. amount: metres of lean at height `h`; h: the plant's height in local units. */
export function addSway(mat, amount = 0.25, h = 1) {
  hook();
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uSwTime = SWAY.uTime; sh.uniforms.uSwWind = SWAY.uWind;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSwTime;\nuniform vec3 uSwWind;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  float hk = clamp(position.y / ${h.toFixed(3)}, 0.0, 1.5);
  hk *= hk;
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float ph = dot(ip.xz, vec2(0.37, 0.21));
  float gust = 0.55 + 0.45 * sin(uSwTime * 1.3 - dot(ip.xz, uSwWind.xz) * 0.06);
  float flutter = sin(uSwTime * 4.1 + ph * 3.0) * 0.35 + sin(uSwTime * 7.3 + ph * 5.0 + position.x * 3.0) * 0.15;
  float lean = ${amount.toFixed(3)} * uSwWind.y * hk * (gust + flutter);
  // lean in world space: undo the instance rotation for the offset direction
  vec3 wdir = vec3(uSwWind.x, 0.0, uSwWind.z);
  #ifdef USE_INSTANCING
  mat3 im = mat3(instanceMatrix);
  vec3 sc = vec3(length(im[0]), length(im[1]), length(im[2]));
  wdir = transpose(im) * wdir / (sc * sc);
  #endif
  transformed += wdir * lean;
  transformed.y -= abs(lean) * 0.25 * hk;
}`);
  };
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.call(mat) : "";
  mat.customProgramCacheKey = () => prevKey + `|sway${amount}/${h}`;
  return mat;
}
