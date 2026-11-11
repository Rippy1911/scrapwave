// Brasswater's buildings: one unit box drawn as thousands of instances. The facade is worked out in the fragment
// shader from the box's own size (floors, bays, windows, shopfronts, warehouse ribs), so a 160 m tower and a 6 m
// shed share one mesh and one material. At night a share of the windows glow (uNight); past ~260 m the windows melt
// into an average tone, which is the shading LOD: no shimmer on the skyline and no extra geometry.
import * as THREE from "three";
import { patch, vtx, frag } from "@/game/render/shaderlib";
import { compose } from "@/game/maps/city/chunks";

const VERT_DECL = "attribute vec4 aBld;\nvarying vec4 vBld;\nvarying vec3 vBP;\nvarying vec3 vBN;\nvarying float vBY;\n";
const VERT_BODY = `
{
  vec3 swSc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vBP = position * swSc;
  vBN = normal;
  vBY = instanceMatrix[3].y + position.y * swSc.y;
  vBld = aBld;
}`;
const FRAG_DECL = `
varying vec4 vBld; varying vec3 vBP; varying vec3 vBN; varying float vBY;
uniform float uNight;
float swWin = 0.0, swLit = 0.0;
float bh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;
// aBld = (floor height, bay width, seed, style): 0 glass curtain wall, 1 punched windows, 2 warehouse, 3 shopfronts.
const COLOR = `#include <color_fragment>
{
  vec3 an = abs(vBN);
  float dist = length(vViewPosition), fade = 1.0 - smoothstep(240.0, 520.0, dist);
  if (an.y > 0.5) {
    diffuseColor.rgb = vec3(0.17, 0.17, 0.175) * (0.8 + 0.5 * bh(floor(vBP.xz * 0.6)));
  } else {
    float fl = vBld.x, bay = vBld.y, sd = vBld.z, style = vBld.w;
    float u = (an.x > 0.5 ? vBP.z : vBP.x) + sd * 31.0, v = vBY;
    vec2 cell = vec2(floor(u / bay), floor(v / fl)), f = vec2(fract(u / bay), fract(v / fl));
    float win = 0.0;
    if (style < 0.5) win = step(0.07, f.x) * step(f.x, 0.93) * step(0.12, f.y) * step(f.y, 0.88);
    else if (style < 1.5) win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.78);
    else if (style < 2.5) win = step(0.15, f.x) * step(f.x, 0.85) * step(0.78, f.y) * step(f.y, 0.94) * step(0.5, fract(u / 11.0));
    else win = v < fl ? step(0.08, f.x) * step(f.x, 0.92) * step(0.1, f.y) * step(f.y, 0.72) : step(0.25, f.x) * step(f.x, 0.75) * step(0.3, f.y) * step(f.y, 0.78);
    float wmask = mix(0.34, win, fade);
    vec3 glass = vec3(0.04, 0.06, 0.08) * (0.7 + 0.8 * bh(cell + sd));
    vec3 wall = diffuseColor.rgb * (0.78 + 0.22 * smoothstep(0.0, 14.0, v)) * (1.0 - 0.1 * step(0.5, fract(u / bay)) * step(style, 1.5));
    if (style > 1.5 && style < 2.5) wall *= 1.0 - 0.14 * step(0.5, fract(u / 1.5));
    diffuseColor.rgb = mix(wall, glass, wmask * 0.92);
    swWin = win * fade;
    swLit = mix(0.2, step(0.52, bh(cell + sd * 3.0)) * mix(0.6, 1.0, bh(cell.yx + 1.7)), fade) * wmask;
  }
}`;
const ROUGH = "float roughnessFactor = mix(roughness, 0.1, swWin);";
const METAL = "float metalnessFactor = mix(metalness, 0.65, swWin);";
const EMIT = `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.76, 0.42) * 1.5 * swLit * uNight;`;

export function createBuildingMaterial(night) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.02 });
  patch(m, "city-building-1", (sh) => {
    sh.uniforms.uNight = night;
    vtx(sh, VERT_DECL, VERT_BODY, "#include <begin_vertex>");
    frag(sh, FRAG_DECL);
    sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", COLOR).replace("#include <roughnessmap_fragment>", ROUGH)
      .replace("#include <metalnessmap_fragment>", METAL).replace("#include <emissivemap_fragment>", EMIT);
  });
  return m;
}

const unit = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const hex = (c) => new THREE.Color(c);

// Registers the building kinds with the chunk grid and adds every planned building: an instance for the body, a
// solid collider (the caller's F), and on the bigger roofs a few boxes of plant (instanced, near range only).
export function addBuildings(C, plan, F, mats, rng) {
  C.kind("buildings", { geometry: unit(), material: mats.building, shadow: true, attr: { name: "aBld", size: 4 } });
  C.kind("roofkit", { geometry: unit(), material: mats.roofkit, range: 300, shadow: false });
  C.kind("beacon", { geometry: new THREE.SphereGeometry(0.5, 6, 4), material: mats.redLight, range: 1100 });
  const col = new THREE.Color();
  let colliders = 0;
  for (const b of plan.buildings) {
    C.add("buildings", b.x, b.z, compose(b.x, b.y, b.z, 0, b.w, b.h, b.d), col.set(b.colour).clone(), [b.fl, b.bay, b.seed * 100, b.style]);
    F.collider(b.x, b.y + b.h / 2, b.z, b.w, b.h, b.d, 0, { tag: "city" });
    colliders++;
    if ((b.h < 12 && !b.crown) || b.route) continue; // low roofs stay bare, and so do the rooftop routes you drive on
    // roof plant: an air-handling block or two, a tank on tall roofs, an aerial on towers
    const top = b.y + b.h, n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const w = 2 + rng() * 3.5, d = 2 + rng() * 3, h = 1 + rng() * 1.6;
      const x = b.x + (rng() - 0.5) * (b.w - w - 3), z = b.z + (rng() - 0.5) * (b.d - d - 3);
      C.add("roofkit", x, z, compose(x, top, z, 0, w, h, d), hex(rng() < 0.3 ? "#7a4f36" : rng() < 0.5 ? "#8b8d8f" : "#5e6266"));
    }
    if (b.crown || (b.type === "office" && b.h > 60)) {
      const ah = 14 + rng() * 16;
      C.add("roofkit", b.x, b.z, compose(b.x, top, b.z, 0, 0.5, ah, 0.5), hex("#2a2b2d")); // aerial
      C.add("beacon", b.x, b.z, compose(b.x, top + ah, b.z, 0, 1.1, 1.1, 1.1)); // its warning light
    }
  }
  return colliders;
}
