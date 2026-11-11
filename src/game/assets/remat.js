// Re-materialing for the GLB models: the bright Kenney low-poly pieces become rusted, sun-faded, sooty scrap
// (world-space triplanar rust over a faded trace of their original paint); realistic props only get tinted.
import * as THREE from "three";
import { pbrSet } from "@/game/assets/assets";
import { TRIPLANAR, WORLD_VARYINGS, WORLD_VERTEX, patch } from "@/game/render/shaderlib";

const cache = new Map();

/**
 * o.paint: how much of the original colour survives (0..1), o.soot: soot amount, o.metres: rust tile size,
 * o.set: PBR set for the base metal (rusty_metal by default).
 */
export function wreckMaterial(src, o = {}) {
  const key = src.uuid + JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);
  const S = pbrSet(o.set || "rusty_metal"), P = pbrSet("painted_metal_chipped");
  const m = new THREE.MeshStandardMaterial({
    map: src.map || null, color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
    roughness: 1, metalness: 1, side: src.side,
  });
  patch(m, "sw-wreck", (sh) => {
    Object.assign(sh.uniforms, {
      tWC: { value: S.map }, tWN: { value: S.normalMap }, tWO: { value: S.ormMap }, tPC: { value: P.map },
      uWScale: { value: 1 / (o.metres || 1.4) }, uWPaint: { value: o.paint ?? 0.45 }, uWSoot: { value: o.soot ?? 0.5 },
    });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + WORLD_VARYINGS)
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + WORLD_VERTEX);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${WORLD_VARYINGS}uniform sampler2D tWC, tWN, tWO, tPC; uniform float uWScale, uWPaint, uWSoot;
vec3 swN = vec3(0.0, 1.0, 0.0); float swR = 1.0, swM = 0.5;\n${TRIPLANAR}`)
      .replace("#include <map_fragment>", `
{
  vec3 wn = normalize(vSwN);
  vec3 tpw = swTpW(wn, 4.0);
  vec3 tp = vSwW * uWScale;
  vec3 rust = swTp(tWC, tp, tpw).rgb;
  vec3 orm = swTp(tWO, tp, tpw).rgb;
  vec3 chip = swTp(tPC, tp * 0.8 + 0.3, tpw).rgb;
  vec3 orig = diffuseColor.rgb;
  #ifdef USE_MAP
  orig *= texture2D(map, vMapUv).rgb;
  #endif
  // faded original paint survives where the chipped-paint mask is light, rust elsewhere
  float keep = smoothstep(0.2, 0.42, swLum(chip)) * uWPaint;
  float ol = swLum(orig);
  vec3 faded = mix(vec3(ol), orig, 0.55) * vec3(1.0, 0.92, 0.82) * 0.85 + 0.04;
  vec3 col = mix(rust, faded * (0.75 + 0.5 * swLum(chip)), keep);
  // soot: dark blooms from below and in patches; dust on top surfaces
  float n = swTp(tPC, tp * 0.17, tpw).g;
  float soot = clamp((1.0 - smoothstep(0.25, 0.7, n)) * uWSoot + (1.0 - smoothstep(-0.2, 0.6, wn.y)) * uWSoot * 0.4, 0.0, 0.85);
  col *= 1.0 - soot;
  col = mix(col, vec3(0.5, 0.41, 0.3), smoothstep(0.6, 1.0, wn.y) * 0.35);
  diffuseColor.rgb = col;
  swR = mix(orm.g, 0.95, soot);
  swM = mix(orm.b, 0.0, soot) * (1.0 - keep * 0.6);
  swN = swTpN(tWN, tp, wn, tpw, 1.0);
}`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = swR;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = swM;")
      .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(swN * faceDirection, 0.0)).xyz);");
  });
  cache.set(key, m);
  return m;
}

/** Clone a GLB material with a colour multiplier (e.g. warm the Poly Haven rocks toward the red mesas). */
export function tinted(src, rgb, extra = {}) {
  const key = src.uuid + rgb.join(",") + JSON.stringify(extra);
  if (cache.has(key)) return cache.get(key);
  const m = src.clone();
  m.color.multiply(new THREE.Color().setRGB(...rgb));
  Object.assign(m, extra);
  cache.set(key, m);
  return m;
}
