// Wind-blown dust: low drifting sheets that hug the ground, occasional dust devils, and short-lived puffs other
// systems kick up (traffic trails, tumbleweeds smashed by cars). One instanced quad pool, one draw call.
// Sheets are upright cylindrical billboards stretched sideways with a scrolling streak texture; devil and puff
// sprites are round billboards using the shared smoke puff. Counts follow the quality preset's `atmos`.
import * as THREE from "three";
import { puffTexture } from "@/game/render/atmosphere";
import { WIND, windSpeedAt } from "@/game/render/wind";

const VS = `
attribute vec4 aP;   // x, y, z world (sheets: ground under the centre), w = size (height)
attribute vec4 aQ;   // x aspect (width / height), y alpha, z rotation (sprites) / seed (sheets), w mode (0 sprite, 1 sheet)
varying vec2 vUv; varying float vA; varying float vMode; varying float vSeed; varying float vFog;
void main() {
  vUv = uv; vMode = aQ.w; vSeed = aQ.z;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp;
  if (aQ.w > 0.5) {
    vec3 r = normalize(vec3(camR.x, 0.0, camR.z) + vec3(1e-4, 0.0, 0.0));
    wp = aP.xyz + r * position.x * aP.w * aQ.x + vec3(0.0, (position.y + 0.5) * aP.w, 0.0);
  } else {
    float c = cos(aQ.z), s = sin(aQ.z);
    vec2 p = mat2(c, -s, s, c) * position.xy * aP.w;
    wp = aP.xyz + camR * p.x + camU * p.y;
  }
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vFog = -mv.z;
  // fade anything right in front of the lens: no full-screen overdraw
  vA = aQ.y * smoothstep(aQ.w > 0.5 ? 6.0 : 1.5, aQ.w > 0.5 ? 18.0 : 5.0, vFog);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform sampler2D tPuff, tNoise; uniform vec3 uColor, uFog; uniform float uFogD, uTime, uLight;
varying vec2 vUv; varying float vA; varying float vMode; varying float vSeed; varying float vFog;
void main() {
  float a;
  if (vMode > 0.5) {
    float n = texture2D(tNoise, vec2(vUv.x * 1.3 - uTime * 0.05 + vSeed, vUv.y * 0.55 + vSeed * 0.37)).r;
    float n2 = texture2D(tNoise, vec2(vUv.x * 3.1 - uTime * 0.11 + vSeed * 2.7, vUv.y * 1.4 + 0.3)).r;
    float m = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * pow(1.0 - vUv.y, 1.7);
    a = m * clamp(n * 0.95 + n2 * 0.55 - 0.42, 0.0, 1.0) * 1.6;
  } else {
    a = texture2D(tPuff, vUv).a;
  }
  a = clamp(a * vA, 0.0, 1.0);
  vec3 col = uColor * uLight * (0.8 + 0.3 * vUv.y);
  float f = 1.0 - exp(-uFogD * max(vFog - 40.0, 0.0));
  col = mix(mix(col, uFog, 0.25), uFog, clamp(f, 0.0, 0.85));
  gl_FragColor = vec4(col, a);
}`;

function noiseTexture() {
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
  const ctx = c.getContext("2d"), img = ctx.createImageData(S, S);
  const R = (i, j) => { const x = Math.sin((i % 16) * 127.1 + (j % 16) * 311.7) * 43758.5453; return x - Math.floor(x); };
  const val = (x, y) => { // tileable value noise, period 16 cells
    const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, uu = u * u * (3 - 2 * u), vv = v * v * (3 - 2 * v);
    const a = R(xi, yi), b = R(xi + 1, yi), cc = R(xi, yi + 1), d = R(xi + 1, yi + 1);
    return (a * (1 - uu) + b * uu) * (1 - vv) + (cc * (1 - uu) + d * uu) * vv;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = val(x / 8, y / 8) * 0.6 + val(x / 4 + 3, y / 4 + 1) * 0.3 + val(x / 2 + 7, y / 2) * 0.1;
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const SHEETS = 30, DEVILS = 4, PER_DEVIL = 34, PUFFS = 120;
const MAX = SHEETS + DEVILS * PER_DEVIL + PUFFS;

export function createDust(scene, terrain, sky = null) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute("position", quad.attributes.position); g.setAttribute("uv", quad.attributes.uv);
  const aP = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aQ = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute("aP", aP); g.setAttribute("aQ", aQ);
  g.instanceCount = 0;
  const fog = scene.fog;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      tPuff: { value: puffTexture() }, tNoise: { value: noiseTexture() }, uColor: { value: new THREE.Color("#d8b48a") },
      uFog: { value: fog ? fog.color : new THREE.Color("#d6b694") }, uFogD: { value: 0.0016 }, uTime: { value: 0 }, uLight: { value: 1 },
    },
    vertexShader: VS, fragmentShader: FS,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  scene.add(mesh);

  let nSheets = 22, nDevils = 3, perDevil = PER_DEVIL;
  const sheets = [], devils = [], puffs = [];
  for (let i = 0; i < SHEETS; i++) sheets.push({ x: 0, z: 0, y: 0, life: 1, max: 0, h: 3, asp: 8, a: 0.5, seed: Math.random() * 10, v: 1 });
  for (let i = 0; i < DEVILS; i++) devils.push({ x: 0, z: 0, life: 1, max: 0, H: 20, spin: 2, vx: 0, vz: 0, ph: Math.random() * 6, delay: 2 + Math.random() * 8 });
  for (let i = 0; i < PUFFS; i++) puffs.push({ life: 1, max: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 2, a: 0.4, rot: 0 });
  let phead = 0;

  // spawn a sheet in a ring around the camera, biased upwind so it drifts across the view
  const spawnSheet = (s, cam, first) => {
    const up = Math.atan2(-WIND.z, -WIND.x);
    const ang = Math.random() < 0.6 ? up + (Math.random() - 0.5) * 2.4 : Math.random() * 6.28;
    const d = 18 + Math.random() * (first ? 150 : 140);
    s.x = cam.position.x + Math.cos(ang) * d; s.z = cam.position.z + Math.sin(ang) * d;
    s.h = 2.2 + Math.random() * 3.2; s.asp = 5 + Math.random() * 6;
    s.a = 0.32 + Math.random() * 0.3; s.v = 0.9 + Math.random() * 0.5;
    s.max = 9 + Math.random() * 10; s.life = first ? Math.random() * s.max : 0;
    s.y = terrain.heightAt(s.x, s.z);
  };
  const spawnDevil = (dv, cam) => {
    for (let k = 0; k < 6; k++) {
      const ang = Math.random() * 6.28, d = 70 + Math.random() * 260;
      const x = cam.position.x + Math.cos(ang) * d, z = cam.position.z + Math.sin(ang) * d;
      if (Math.abs(x) > 590 || Math.abs(z) > 590) continue;
      dv.x = x; dv.z = z;
      dv.H = 14 + Math.random() * 16; dv.spin = (2 + Math.random() * 1.5) * (Math.random() < 0.5 ? 1 : -1);
      dv.max = 16 + Math.random() * 18; dv.life = 0; dv.ph = Math.random() * 6.28;
      const a = Math.random() * 6.28;
      dv.vx = WIND.x * 2.2 + Math.cos(a) * 1.5; dv.vz = WIND.z * 2.2 + Math.sin(a) * 1.5;
      return true;
    }
    return false;
  };

  /** A short-lived dust puff (vehicle trails, impacts). o: { size, grow, life, alpha, rise, vx, vz } */
  function puff(x, y, z, o = {}) {
    const p = puffs[phead]; phead = (phead + 1) % PUFFS;
    p.life = 0; p.max = (o.life || 2.2) * (0.8 + Math.random() * 0.4);
    p.x = x; p.y = y; p.z = z;
    p.vx = (o.vx || 0) + (Math.random() - 0.5) * 0.8; p.vy = o.rise ?? 0.6; p.vz = (o.vz || 0) + (Math.random() - 0.5) * 0.8;
    p.s0 = (o.size || 1.6) * 0.6; p.s1 = (o.size || 1.6) * (o.grow || 2.6); p.a = o.alpha ?? 0.4; p.rot = Math.random() * 6.28;
  }

  let started = false;
  const sun = scene.children.find((o) => o.isDirectionalLight);
  const sun0 = sun ? sun.intensity : 1;
  function update(cam, dt, time) {
    mat.uniforms.uTime.value = time;
    const dusk = sky && sky.mode === "dusk";
    mat.uniforms.uLight.value = sun ? Math.min(1.1, 0.35 + 0.65 * (sun.intensity / Math.max(0.1, sun0))) * (dusk ? 0.75 : 1) : 1;
    if (!started) { started = true; for (const s of sheets) spawnSheet(s, cam, true); }
    let n = 0;
    // sheets
    const R2 = 175 * 175;
    for (let i = 0; i < nSheets; i++) {
      const s = sheets[i];
      s.life += dt;
      const ws = windSpeedAt(s.x, s.z) * s.v;
      s.x += WIND.x * ws * dt; s.z += WIND.z * ws * dt;
      if (s.life >= s.max || (s.x - cam.position.x) ** 2 + (s.z - cam.position.z) ** 2 > R2) { spawnSheet(s, cam, false); continue; }
      const k = s.life / s.max, env = Math.sin(Math.PI * k);
      s.y += (terrain.heightAt(s.x, s.z) - s.y) * Math.min(1, dt * 3);
      aP.setXYZW(n, s.x, s.y - 0.4, s.z, s.h);
      aQ.setXYZW(n, s.asp, s.a * env * env, s.seed, 1);
      n++;
    }
    // devils: a twisting column of puffs, wider and fainter with height, leaning downwind
    for (let i = 0; i < nDevils; i++) {
      const dv = devils[i];
      if (dv.delay > 0) { dv.delay -= dt; if (dv.delay <= 0 && !spawnDevil(dv, cam)) dv.delay = 3; continue; }
      dv.life += dt;
      if (dv.life >= dv.max || (dv.x - cam.position.x) ** 2 + (dv.z - cam.position.z) ** 2 > 420 * 420) { dv.delay = 4 + Math.random() * 14; continue; }
      dv.ph += dt * dv.spin;
      dv.x += dv.vx * dt; dv.z += dv.vz * dt;
      const env = Math.min(1, dv.life / 3) * Math.min(1, (dv.max - dv.life) / 4);
      const gy = terrain.heightAt(dv.x, dv.z), H = dv.H * (0.6 + 0.4 * env);
      for (let j = 0; j < perDevil; j++) {
        const skirt = j < 6, f = skirt ? 0.02 : (j - 6) / (perDevil - 6);
        const h = skirt ? 0.4 + Math.sin(j * 2.1 + dv.ph) * 0.2 : f * H;
        const ang = dv.ph * (skirt ? 0.6 : 1.4 - f * 0.6) + j * 2.39996;
        const rad = skirt ? 2.4 + (j % 3) * 1.1 : 0.5 + Math.pow(f, 1.4) * 5.5;
        const lean = f * H * 0.18;
        const x = dv.x + Math.cos(ang) * rad + WIND.x * lean, z = dv.z + Math.sin(ang) * rad + WIND.z * lean;
        aP.setXYZW(n, x, gy + h + 0.5, z, skirt ? 4.5 : 1.6 + f * 5.5);
        aQ.setXYZW(n, 1, env * (skirt ? 0.3 : 0.42 * Math.pow(1 - f, 0.6)), ang * 1.3, 0);
        n++;
      }
    }
    // puffs
    const wx = WIND.x * WIND.speed * 0.5, wz = WIND.z * WIND.speed * 0.5;
    for (const p of puffs) {
      if (p.life >= p.max) continue;
      p.life += dt;
      const k = p.life / p.max;
      p.x += (p.vx + wx * k) * dt; p.y += p.vy * dt; p.z += (p.vz + wz * k) * dt; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
      aP.setXYZW(n, p.x, p.y, p.z, p.s0 + (p.s1 - p.s0) * Math.sqrt(k));
      aQ.setXYZW(n, 1, p.a * smoothIn(k) * (1 - k) * (1 - k), p.rot + k, 0);
      n++;
    }
    g.instanceCount = n;
    aP.needsUpdate = true; aQ.needsUpdate = true;
    return n;
  }
  const smoothIn = (k) => Math.min(1, k * 8);

  function setQuality(q) {
    const a = q.atmos ?? 1;
    nSheets = Math.max(6, Math.min(SHEETS, Math.round(22 * a)));
    nDevils = Math.max(1, Math.min(DEVILS, Math.round(3 * a)));
    perDevil = a < 0.5 ? 22 : PER_DEVIL;
  }
  return { mesh, update, puff, setQuality, counts: () => ({ sheets: nSheets, devils: devils.slice(0, nDevils).filter((d) => d.delay <= 0).length, sprites: g.instanceCount }) };
}
