// Late-afternoon sky: the Sky addon (smaller, softer sun disc, haze band matched to the fog), image-based light
// from the quarry_01 HDRI (sun clamped so it does not double the directional light), one shadowed sun aligned with
// the HDRI, a weak hemisphere fill and exponential height fog that keeps the foreground clear.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RENDER } from "@/game/data/tuning";
import { RC, onFrame, onQuality } from "@/game/render/frame";
import { lookFor } from "@/game/render/lookQuality";
import { createAtmosphere } from "@/game/render/atmosphere";

const F = RENDER.fog;
const sunFrom = (elevDeg, azDeg, out = new THREE.Vector3()) =>
  out.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevDeg), THREE.MathUtils.degToRad(azDeg));
const SUN0 = sunFrom(RENDER.sunElevation, RENDER.sunAzimuth);
const f3 = (v) => `vec3(${v.map((x) => (+x).toFixed(4)).join(", ")})`;

// Height fog for every built-in material: density falls off with altitude, nothing before F.start metres,
// warmer and brighter toward the sun. Uses scene.fog (FogExp2) colour and density so storms can still drive it.
(function installHeightFog() {
  const C = THREE.ShaderChunk;
  if (C.fog_fragment.includes("swHeightFog")) return;
  C.fog_pars_vertex = "#ifdef USE_FOG\nvarying vec3 vFogWorld;\n#endif";
  C.fog_vertex = "#ifdef USE_FOG\nvFogWorld = cameraPosition + (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;\n#endif";
  C.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor;
varying vec3 vFogWorld;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;
uniform float fogFar;
#endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
{ // swHeightFog
  vec3 fr = vFogWorld - cameraPosition;
  float fd = length(fr);
  vec3 fdir = fr / max(fd, 1e-3);
  #ifdef FOG_EXP2
  float fk = ${F.falloff.toFixed(4)};
  float h0 = exp(-fk * max(cameraPosition.y - ${F.base.toFixed(1)}, -20.0));
  float dy = fr.y * fk;
  float line = abs(dy) > 1e-3 ? (1.0 - exp(-dy)) / dy : 1.0;
  float amt = 1.0 - exp(-fogDensity * h0 * line * max(fd - ${F.start.toFixed(1)}, 0.0));
  #else
  float amt = smoothstep(fogNear, fogFar, fd);
  #endif
  vec3 sunH = normalize(vec3(${SUN0.x.toFixed(4)}, 0.0, ${SUN0.z.toFixed(4)}));
  float toSun = pow(max(dot(normalize(vec3(fdir.x, 0.0, fdir.z) + 1e-5), sunH), 0.0), 5.0);
  vec3 fc = fogColor * mix(vec3(1.0), ${f3(F.sunTint)}, toSun);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, clamp(amt, 0.0, ${F.max.toFixed(3)}));
}
#endif`;
})();

const FOG_CLEAR = new THREE.Color(F.color);
const FOG_STORM = new THREE.Color("#7a5232");
const FOG_DUSK = new THREE.Color("#b8704a");

// Value-noise fbm for the cloud layer (5 octaves, cheap: the sky is one full-screen pass).
const CLOUD_GLSL = `
float swCloudH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float swCloudN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(swCloudH(i), swCloudH(i + vec2(1.0, 0.0)), f.x), mix(swCloudH(i + vec2(0.0, 1.0)), swCloudH(i + vec2(1.0, 1.0)), f.x), f.y); }
float swCloudF(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * swCloudN(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
`;

function patchSky(sky) {
  const S = RENDER.sky, m = sky.material;
  Object.assign(m.uniforms, {
    uDiscCos: { value: 0.99995 }, uDiscSoft: { value: 0.00003 }, uDiscGain: { value: 0.06 },
    uSkyGain: { value: S.gain }, uHaze: { value: S.haze }, uHazeH: { value: 0.16 },
    uHazeColor: { value: FOG_CLEAR.clone() }, uHazeSun: { value: new THREE.Vector3(...F.sunTint) },
    uClouds: { value: 1 }, uCloudT: { value: 0 },
  });
  m.fragmentShader = m.fragmentShader
    .replace("uniform vec3 up;", "uniform vec3 up;\nuniform float uDiscCos, uDiscSoft, uDiscGain, uSkyGain, uHaze, uHazeH, uClouds, uCloudT;\nuniform vec3 uHazeColor, uHazeSun;\n" + CLOUD_GLSL)
    .replace(/float sundisk = smoothstep\([^;]*;/, "float sundisk = smoothstep( uDiscCos - uDiscSoft, uDiscCos + uDiscSoft, cosTheta );")
    .replace("L0 += ( vSunE * 19000.0 * Fex ) * sundisk;", "L0 += ( vSunE * 19000.0 * uDiscGain * Fex ) * sundisk;")
    .replace("gl_FragColor = vec4( retColor, 1.0 );", `
      retColor *= uSkyGain;
      // high desert cirrus: streaks stretched along the wind on a flat layer, lit warm toward the sun, gone at the horizon
      if (uClouds > 0.0 && direction.y > 0.0) {
        vec2 cp = direction.xz / (direction.y + 0.1) * 1.4 + vec2(uCloudT * 0.0035, uCloudT * 0.0012);
        vec2 qd = vec2(cp.x * 0.5 + cp.y * 0.32, cp.y * 1.2 - cp.x * 0.24);
        float cn = swCloudF(qd * 1.25 + swCloudF(cp * 0.7) * 0.6);
        float cov = smoothstep(0.5, 0.78, cn) * smoothstep(0.16, 0.5, direction.y) * uClouds;
        float sunF = pow(max(dot(direction, normalize(vSunDirection)), 0.0), 6.0);
        float L = dot(retColor, vec3(0.3, 0.59, 0.11));
        vec3 cc = mix(vec3(1.0, 0.96, 0.92), vec3(1.3, 1.02, 0.74), sunF) * (L * 1.25 + 0.1) * (0.82 + 0.3 * smoothstep(0.6, 0.9, cn));
        retColor = mix(retColor, cc, cov * 0.55);
      }
      float hzn = 1.0 - smoothstep(-0.03, uHazeH, direction.y);
      vec3 dh = normalize(vec3(direction.x, 0.0, direction.z) + 1e-5), sh = normalize(vec3(vSunDirection.x, 0.0, vSunDirection.z) + 1e-5);
      vec3 hz = uHazeColor * mix(vec3(1.0), uHazeSun, pow(max(dot(dh, sh), 0.0), 5.0));
      retColor = mix(retColor, hz, hzn * hzn * uHaze);
      gl_FragColor = vec4( retColor, 1.0 );`);
  m.needsUpdate = true;
}

export function createSky(renderer, scene) {
  const S = RENDER.sky;
  const sky = new Sky();
  sky.scale.setScalar(3000);
  patchSky(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = S.turbidity; u.rayleigh.value = S.rayleigh; u.mieCoefficient.value = S.mie; u.mieDirectionalG.value = S.mieG;
  const sunDir = SUN0.clone();
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // Interim environment from the sky until the HDRI arrives.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(1000);
  for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"]) envSky.material.uniforms[k].value = u[k].value;
  envSky.material.uniforms.sunPosition.value.copy(sunDir);
  envScene.add(envSky);
  let envRT = pmrem.fromScene(envScene, 0, 1, 2000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = RENDER.envIntensity * 0.6;

  if (typeof window !== "undefined") {
    new RGBELoader().setDataType(THREE.FloatType).load(RENDER.hdri, (tex) => {
      const d = tex.image.data, cap = RENDER.hdriClamp;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        if (l > cap) { const k = cap / l; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
      }
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.needsUpdate = true;
      const rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      envRT.dispose();
      envRT = rt; api.envRT = rt;
      scene.environment = rt.texture;
      scene.environmentIntensity = api.envIntensity;
    }, undefined, () => {});
  }

  scene.fog = new THREE.FogExp2(FOG_CLEAR.clone(), F.density);

  const sunColor = new THREE.Color().setRGB(...RENDER.sunColor, THREE.LinearSRGBColorSpace);
  const sun = new THREE.DirectionalLight(sunColor, RENDER.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(RENDER.hemiSky, RENDER.hemiGround, RENDER.hemiIntensity);
  scene.add(hemi);

  const lightR = new THREE.Vector3(), lightU = new THREE.Vector3(), tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  const api = {
    sky, sun, hemi, sunDir, envRT, range: 100, envIntensity: RENDER.envIntensity, storm: 0, mode: "day",
    base: { sun: RENDER.sunIntensity, hemi: RENDER.hemiIntensity, env: RENDER.envIntensity, fog: FOG_CLEAR.clone(), density: F.density },
    update(center, camPos) {
      sky.position.copy(camPos);
      // Box ahead of the camera, snapped to shadow texels in light space so edges never crawl.
      fwd.subVectors(center, camPos).setY(0);
      const fl = fwd.length();
      tmp.copy(center);
      if (fl > 0.01) tmp.addScaledVector(fwd, (api.range * 0.35) / fl);
      lightR.crossVectors(sunDir, THREE.Object3D.DEFAULT_UP).normalize();
      lightU.crossVectors(lightR, sunDir).normalize();
      const texel = (2 * api.range) / sun.shadow.mapSize.x;
      const a = Math.round(tmp.dot(lightR) / texel) * texel, b = Math.round(tmp.dot(lightU) / texel) * texel, c = tmp.dot(sunDir);
      tmp.copy(lightR).multiplyScalar(a).addScaledVector(lightU, b).addScaledVector(sunDir, c);
      sun.target.position.copy(tmp);
      sun.position.copy(tmp).addScaledVector(sunDir, 450);
    },
    setShadowRange(r) {
      api.range = r;
      const sc = sun.shadow.camera;
      sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 450 + r * 2.5;
      sc.updateProjectionMatrix();
      const texel = (2 * r) / sun.shadow.mapSize.x;
      sun.shadow.bias = -0.00006;
      sun.shadow.normalBias = texel * 1.6;
    },
    setStorm(k) {
      api.storm = k;
      const b = api.base;
      scene.fog.color.copy(b.fog).lerp(FOG_STORM, k);
      scene.fog.density = b.density + k * 0.009;
      sun.intensity = b.sun * (1 - k * 0.65);
      hemi.intensity = b.hemi * (1 - k * 0.3);
      u.turbidity.value = S.turbidity + k * 10;
      u.uHazeColor.value.copy(scene.fog.color);
    },
    setShadows(on, size) {
      sun.castShadow = on;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
      api.setShadowRange(RC.q?.shadowRange || api.range);
    },
    // Photo/trailer helper: "day" (gameplay) or "dusk" (sun on the horizon, lamps and flares carry the scene).
    setTimeOfDay(mode, azimuthDeg) {
      api.mode = mode;
      const dusk = mode === "dusk";
      sunFrom(dusk ? 3.5 : RENDER.sunElevation, azimuthDeg ?? RENDER.sunAzimuth + (dusk ? -6 : 0), sunDir);
      u.sunPosition.value.copy(sunDir);
      sun.color.copy(dusk ? new THREE.Color().setRGB(1.0, 0.42, 0.16, THREE.LinearSRGBColorSpace) : sunColor);
      api.base.sun = dusk ? 2.3 : RENDER.sunIntensity;
      api.base.hemi = dusk ? 0.16 : RENDER.hemiIntensity;
      api.base.fog = dusk ? FOG_DUSK.clone() : FOG_CLEAR.clone();
      api.base.density = dusk ? F.density * 1.25 : F.density;
      api.envIntensity = dusk ? RENDER.envIntensity * 0.32 : RENDER.envIntensity;
      scene.environmentIntensity = api.envIntensity;
      u.turbidity.value = dusk ? 5 : S.turbidity; u.rayleigh.value = dusk ? 2.4 : S.rayleigh;
      u.uSkyGain.value = dusk ? S.gain * 0.8 : S.gain;
      u.uHazeH.value = dusk ? 0.42 : 0.16;
      u.uHaze.value = dusk ? 0.95 : S.haze;
      u.uHazeSun.value.set(...(dusk ? [1.9, 1.0, 0.55] : F.sunTint));
      renderer.toneMappingExposure = RENDER.exposure * (dusk ? 1.3 : 1);
      api.setStorm(api.storm);
    },
  };
  api.setShadowRange(RC.q?.shadowRange || 100);
  onQuality(() => { u.uClouds.value = lookFor().clouds ? 1 : 0; });
  onFrame((cam, dt, t) => { u.uCloudT.value = t || 0; }, scene);
  // Dust, smoke, fires and birds start on the first rendered frame, once the world has registered its emitters.
  const offAtmos = onFrame(() => { offAtmos(); api.atmosphere = createAtmosphere(scene, sunDir, sun.color, scene.fog, api); }, scene);
  if (typeof window !== "undefined" && window.scrapwakeGfx) Object.assign(window.scrapwakeGfx, { sky: api, setTimeOfDay: api.setTimeOfDay });
  return api;
}
