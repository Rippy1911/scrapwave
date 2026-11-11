// Shared material library: CC0 PBR sets (colour, OpenGL normal, ORM) at real-world scale, plus the procedural
// canvas textures for signs, plates and hazard stripes. Keys are stable: world, vehicles and weapons use them.
import * as THREE from "three";
import { canvas, toTex } from "@/game/render/textures";
import { pbrSet } from "@/game/assets/assets";
import { addGrime, addPaintTint, patch, vtx, frag, WORLD_VARYINGS, WORLD_VERTEX } from "@/game/render/shaderlib";

const TILE = 2; // metres per UV unit on the building kit (see places/kit.js scaleUV)

/** HDR colour for unlit emissive things so bloom (threshold ~1.2) only catches them. */
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

export function createMaterials(T) {
  const kitSet = (name) => {
    const S = pbrSet(name), rep = TILE / S.metres;
    for (const t of [S.map, S.normalMap, S.ormMap]) t.repeat.set(rep, rep);
    return S;
  };
  // A PBR material on kit UVs (2 m per unit) with world-space grime so repeats never look stamped.
  const pbr = (name, o = {}) => {
    const S = kitSet(name);
    const m = new THREE.MeshStandardMaterial({
      map: S.map, normalMap: S.normalMap, roughnessMap: S.ormMap, metalnessMap: S.ormMap, aoMap: S.ormMap,
      aoMapIntensity: o.ao ?? 0.85, color: o.color || "#ffffff", roughness: o.roughness ?? 1, metalness: o.metalness ?? 1,
      envMapIntensity: o.env ?? 1, side: o.side || THREE.FrontSide,
    });
    m.normalScale.set(o.normal ?? 1, o.normal ?? 1);
    if (o.tint) addPaintTint(m, o.tint);
    if (o.grime !== 0) addGrime(m, T.noise, o.grime ?? 0.22, o.streaks ?? 0.18);
    return m;
  };
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

  const M = {
    rust: pbr("rusty_metal", { roughness: 1, metalness: 1 }),
    dark: pbr("painted_metal_chipped", { tint: "#3a3833", roughness: 0.95 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#c9c4bb", roughness: 0.32, metalness: 1, envMapIntensity: 1.2 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#1c1b1a", roughness: 0.9, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: "#121a1e", roughness: 0.06, metalness: 0.7, envMapIntensity: 1.7 }),
    light: new THREE.MeshStandardMaterial({ color: "#fff3d0", emissive: "#ffd28a", emissiveIntensity: 6, roughness: 0.3 }),
    redLight: new THREE.MeshStandardMaterial({ color: "#ff3a20", emissive: "#ff2a10", emissiveIntensity: 7 }),
    hazard: null,
    bone: pbr("painted_metal_chipped", { tint: "#d8cdb2", roughness: 1 }),
    wood: pbr("wood_planks_old", { metalness: 0 }),
    corrugated: pbr("corrugated_rusty", { metalness: 1, streaks: 0.28 }),
    concrete: pbr("concrete_cracked", { metalness: 0, streaks: 0.25 }),
    rock: pbr("red_rock", { metalness: 0, color: "#f2d8c4" }),
    sand: pbr("sand_ripples", { metalness: 0, grime: 0.12, streaks: 0 }),
    tarp: addGrime(new THREE.MeshStandardMaterial({ color: "#5d6b5a", roughness: 0.95 }), T.noise, 0.25, 0.1),
    cloth: addGrime(new THREE.MeshStandardMaterial({ color: "#a8462c", roughness: 0.95, side: THREE.DoubleSide }), T.noise, 0.25, 0.1),
    water: new THREE.MeshStandardMaterial({ color: "#26383b", roughness: 0.1, metalness: 0.3, envMapIntensity: 1.4 }),
    fire: basic(hdr("#ff8a33", 9)),
    lamp: basic(hdr("#ffd29a", 7)),
    glow: basic(hdr("#ffd9a0", 2), { transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    beam: basic(hdr("#ffd06a", 1.6), { transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    turbo: basic(hdr("#7fb4ff", 7), { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    tracer: basic(hdr("#ffcf7a", 10)),
    asphalt: null, railbed: null, dirt: null,
  };
  {
    const S = kitSet("painted_metal_chipped");
    M.hazard = addGrime(new THREE.MeshStandardMaterial({ map: T.hazard, normalMap: S.normalMap, roughnessMap: S.ormMap, roughness: 0.9, metalness: 0.25 }), T.noise, 0.2, 0.15);
  }
  M.asphalt = ribbon("asphalt", T);
  M.dirt = ribbon("dirt", T);
  M.railbed = ribbon("rail", T);

  const paints = new Map();
  M.paint = (hex) => {
    if (!paints.has(hex)) { const m = pbr("painted_metal_chipped", { tint: hex, roughness: 0.9 }); m.userData.paintHex = hex; paints.set(hex, m); }
    return paints.get(hex);
  };
  M.pbr = pbr;
  const plates = new Map();
  M.plate = (text) => {
    if (!plates.has(text)) {
      const c = canvas(128); c.height = 48;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#d9cca8"; ctx.fillRect(0, 0, 128, 48);
      ctx.strokeStyle = "#2a2018"; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 124, 44);
      ctx.fillStyle = "#1e1a14"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, 64, 26);
      const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      const pm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2 });
      pm.userData.keepUV = true;
      plates.set(text, pm);
    }
    return plates.get(text);
  };
  M.sign = (text, sub, bg = "#e9dcc0", fg = "#7a2410", w = 512, h = 192) => {
    const c = canvas(w); c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(120,70,30,0.22)";
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 30, 2 + Math.random() * 8);
    ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.floor(h * 0.36)}px Impact, "Black Ops One", sans-serif`;
    ctx.fillText(text, w / 2, h * (sub ? 0.4 : 0.5));
    if (sub) { ctx.font = `bold ${Math.floor(h * 0.14)}px sans-serif`; ctx.fillStyle = "#2b241c"; ctx.fillText(sub, w / 2, h * 0.76); }
    ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8);
    // sun-bleached and grimy: a vertical streak gradient and a darker bottom edge
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(60,40,20,0.05)"); g.addColorStop(0.8, "rgba(60,40,20,0.12)"); g.addColorStop(1, "rgba(50,32,16,0.35)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const W = kitSet("wood_planks_old");
    const sm = new THREE.MeshStandardMaterial({ map: t, normalMap: W.normalMap, roughness: 0.82, metalness: 0 });
    sm.normalScale.set(0.5, 0.5);
    sm.userData.keepUV = true;
    return sm;
  };
  return M;
}

// Road ribbons (uv.x 0..1 across, uv.y = metres / (1.4 width) along): world-projected PBR surface,
// lane paint drawn in the shader, wind-blown sand drifts and dusty shoulders that fade into the ground.
function ribbon(kind, T) {
  const A = pbrSet(kind === "asphalt" ? "asphalt_damaged" : "gravel_dirt");
  const S = pbrSet("sand_ripples");
  const m = new THREE.MeshStandardMaterial({
    map: kind === "rail" ? T.rail : null, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return patch(m, "ribbon-" + kind, (sh) => {
    Object.assign(sh.uniforms, {
      tRC: { value: A.map }, tRN: { value: A.normalMap }, tRO: { value: A.ormMap },
      tSC: { value: S.map }, tNz: { value: T.noise },
    });
    vtx(sh, WORLD_VARYINGS + "varying vec2 vRUv;\n", WORLD_VERTEX + "\nvRUv = uv;");
    frag(sh, WORLD_VARYINGS + "varying vec2 vRUv;\nuniform sampler2D tRC, tRN, tRO, tSC, tNz;\nvec3 swRoadN = vec3(0.0, 1.0, 0.0);\nfloat swRough = 1.0;\n");
    const isAsphalt = kind === "asphalt", isRail = kind === "rail";
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `
{
  vec2 wuv = vSwW.xz / ${A.metres.toFixed(1)};
  float nz = texture2D(tNz, vSwW.xz * 0.012).r;
  float nz2 = texture2D(tNz, vSwW.xz * 0.06 + 0.3).g;
  vec3 c = mix(texture2D(tRC, wuv).rgb, texture2D(tRC, wuv * 0.23 + 0.41).rgb, 0.35);
  vec3 o = texture2D(tRO, wuv).rgb;
  vec3 tn = texture2D(tRN, wuv).xyz * 2.0 - 1.0;
  vec3 sand = texture2D(tSC, vSwW.xz / 4.0).rgb;
  float across = vRUv.x, edge = min(across, 1.0 - across);
  ${isRail ? `
  vec4 rail = texture2D(map, vMapUv);
  c = mix(c * 0.9, rail.rgb, 0.75);` : ""}
  ${isAsphalt ? `
  c = pow(c, vec3(1.15)) * vec3(0.74, 0.73, 0.74);
  float dash = step(fract(vRUv.y * 1.65), 0.38);
  float centre = (1.0 - smoothstep(0.006, 0.011, abs(across - 0.5))) * dash;
  float side = 1.0 - smoothstep(0.005, 0.009, abs(edge - 0.075));
  float wear = smoothstep(0.28, 0.62, nz2) * (0.55 + 0.45 * nz);
  c = mix(c, vec3(0.62, 0.46, 0.12), centre * wear * 0.85);
  c = mix(c, vec3(0.66, 0.64, 0.6), side * wear * 0.8);
  o.g = mix(o.g, 0.62, (centre + side) * wear);
  // oil and rubber in the wheel tracks
  float track = exp(-pow((edge - 0.27) / 0.06, 2.0));
  c *= 1.0 - track * 0.18;` : isRail ? "" : `
  float rut = exp(-pow((edge - 0.3) / 0.05, 2.0));
  c = mix(c, c * vec3(0.78, 0.72, 0.66), rut * 0.7);
  c *= vec3(0.62, 0.55, 0.5); // packed dark earth, so the track reads against the pale sand
  c = mix(c, sand * 0.7, 0.08 + 0.1 * nz);
  c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.16, edge)); // darker berm line along both edges
  tn.xy *= 1.0 - rut * 0.6;`}
  // drifts and dusty shoulders fading into the ground
  // drifts: long tongues of sand blown across from the shoulders, not round blotches
  float tongue = texture2D(tNz, vec2(vSwW.x * 0.004 + vSwW.z * 0.02, vSwW.z * 0.004 - vSwW.x * 0.02)).g;
  float drift = smoothstep(0.7, 0.92, tongue * 0.75 + nz * 0.35) * smoothstep(0.55, 0.05, edge) * ${isAsphalt ? "0.55" : "0.18"};
  float shoulder = 1.0 - smoothstep(0.0, ${isAsphalt ? "0.13" : "0.06"}, edge);
  float dust = clamp(max(drift, shoulder * (0.65 + 0.35 * nz)), 0.0, 1.0);
  c = mix(c, sand * vec3(0.96, 0.93, 0.9), dust);
  tn.xy *= 1.0 - dust * 0.7;
  o.g = mix(o.g, 0.95, dust);
  diffuseColor.rgb *= c;
  swRough = max(o.g, ${isAsphalt ? "0.78" : "0.9"});
  swRoadN = normalize(vec3(tn.x, tn.z, tn.y));
}`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = swRough;")
      .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(swRoadN, 0.0)).xyz);");
  });
}
