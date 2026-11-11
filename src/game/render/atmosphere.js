// Atmosphere: drifting dust around the camera, smoke plumes (refinery flares, burning wrecks, horizon fires), small
// flickering fires with a glow halo and embers, and vultures circling the refinery and the wrecks. All GPU-cheap:
// one Points cloud, one instanced smoke quad pool, one fire pool, one glow pool, one ember cloud, three instanced
// bird meshes. Emitters register from world code (addSmoke / addFire / addFlock) at build time. Smoke leans with
// the shared wind (render/wind.js).
import * as THREE from "three";
import { onFrame, onQuality, RC } from "@/game/render/frame";
import { WIND, tickWind } from "@/game/render/wind";

// Emitters registered per scene (world code passes kit.scene).
const registries = new WeakMap();
const reg = (scene) => { if (!registries.has(scene)) registries.set(scene, { plumes: [], fires: [], flocks: [] }); return registries.get(scene); };

/**
 * A rising smoke column. kind: "black" (oil fire) | "grey" (smouldering wreck). rate: puffs per second.
 * life: seconds a puff lives (default 9 black, 6 grey); far: emit only while the camera is within this many metres
 * (default 900; horizon columns pass more so they stand on the skyline from anywhere in the basin).
 */
export function addSmoke(scene, x, y, z, o = {}) { reg(scene).plumes.push({ x, y, z, kind: o.kind || "grey", rate: o.rate || 3, size: o.size || 3, rise: o.rise || 3, life: o.life || 0, far: o.far || 900, acc: Math.random() }); }
/** A small flickering fire (emissive, bloom catches it). */
export function addFire(scene, x, y, z, size = 1) { reg(scene).fires.push({ x, y, z, size, t: Math.random() * 10 }); }
/** Birds circling a point. */
export function addFlock(scene, x, y, z, n = 6, radius = 40) { reg(scene).flocks.push({ x, y, z, n, radius }); }

let puffTex = null;
/** Soft noisy smoke puff (white, alpha blob), shared by every billboard pool. */
export function puffTexture() {
  if (puffTex) return puffTex;
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(S, S);
  // soft blob with value-noise breakup
  const R = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => R(a * 57 + b * 131);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return h(xi, yi) * (1 - u) * (1 - v) + h(xi + 1, yi) * u * (1 - v) + h(xi, yi + 1) * (1 - u) * v + h(xi + 1, yi + 1) * u * v;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x / S - 0.5, dy = y / S - 0.5, d = Math.hypot(dx, dy) * 2;
    const n = noise(x / 16, y / 16) * 0.65 + noise(x / 8, y / 8) * 0.35;
    const a = Math.max(0, 1 - d) ** 1.8 * (0.6 + n * 0.6);
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 200 + n * 55; img.data[i + 3] = Math.min(255, a * 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  puffTex = t;
  return t;
}

// Additive glow halo around each fire: a camera-facing quad with a radial falloff, flickering per instance.
const GLOW_VS = `
attribute vec4 aG; // x,y,z world, w = size
attribute float aI;
varying vec2 vUv; varying float vI;
void main() {
  vUv = uv; vI = aI;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = aG.xyz + (camR * position.x + camU * position.y) * aG.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const GLOW_FS = `
uniform vec3 uColor; uniform float uGain;
varying vec2 vUv; varying float vI;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.2);
  gl_FragColor = vec4(uColor * a * vI * uGain, 1.0);
}`;

const SMOKE_VS = `
attribute vec4 aPuff;   // x,y,z world, w = size
attribute vec4 aLife;   // age 0..1, rotation, kind (0 grey, 1 black), alpha
varying vec2 vUv; varying vec4 vLife; varying float vFog;
void main() {
  vUv = uv; vLife = aLife;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(aLife.y), s = sin(aLife.y);
  vec2 p = mat2(c, -s, s, c) * position.xy * aPuff.w;
  vec3 wp = aPuff.xyz + camR * p.x + camU * p.y;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SMOKE_FS = `
uniform sampler2D tPuff; uniform vec3 uSun; uniform vec3 uFog; uniform float uFogD;
varying vec2 vUv; varying vec4 vLife; varying float vFog;
void main() {
  vec4 t = texture2D(tPuff, vUv);
  float age = vLife.x;
  vec3 dark = mix(vec3(0.42, 0.4, 0.38), vec3(0.06, 0.055, 0.05), vLife.z);
  vec3 lit = dark + uSun * mix(0.35, 0.08, vLife.z) * (0.4 + 0.6 * vUv.y);
  vec3 col = mix(lit, lit * 1.25 + 0.05, age);
  float a = t.a * vLife.w * smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.55, 1.0, age));
  float f = 1.0 - exp(-uFogD * max(vFog - 60.0, 0.0));
  col = mix(col, uFog, clamp(f, 0.0, 0.9));
  gl_FragColor = vec4(col * t.r / 230.0, a);
}`;

export function createAtmosphere(scene, sunDir, sunColor, fog, sky = null) {
  const { plumes, fires, flocks } = reg(scene);
  // ---------------------------------------------------------------- dust motes around the camera
  const DUST = 900, BOX = 70;
  const dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) { dpos[i * 3] = Math.random() * BOX; dpos[i * 3 + 1] = Math.random() * 18; dpos[i * 3 + 2] = Math.random() * BOX; dseed[i] = Math.random(); }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  dg.setAttribute("aSeed", new THREE.BufferAttribute(dseed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: BOX }, uColor: { value: new THREE.Color("#e9cfa6") }, uAmount: { value: 1 }, uScale: { value: 600 } },
    vertexShader: `
      attribute float aSeed; uniform float uTime, uBox, uScale; uniform vec3 uCam; varying float vA;
      void main() {
        vec3 wind = vec3(2.4, 0.15, 0.9) * (0.6 + aSeed);
        vec3 p = position + wind * uTime + vec3(sin(uTime * 0.7 + aSeed * 40.0), sin(uTime * 0.5 + aSeed * 13.0) * 0.4, cos(uTime * 0.6 + aSeed * 23.0)) * 0.8;
        p.xz = mod(p.xz - uCam.xz + uBox * 0.5, uBox) + uCam.xz - uBox * 0.5;
        p.y = mod(p.y, 18.0) + uCam.y - 7.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vA = smoothstep(1.5, 5.0, d) * (1.0 - smoothstep(22.0, 34.0, d)) * (0.35 + 0.65 * aSeed);
        gl_PointSize = clamp((0.05 + aSeed * 0.06) * uScale / max(d, 0.5), 1.0, 7.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAmount; varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)) * vA * 0.32 * uAmount; gl_FragColor = vec4(uColor * 1.4, a); }`,
  });
  const dust = new THREE.Points(dg, dustMat);
  dust.frustumCulled = false; dust.renderOrder = 4;
  scene.add(dust);

  // ---------------------------------------------------------------- smoke
  const MAXP = 1000;
  const quad = new THREE.PlaneGeometry(1, 1);
  const sg = new THREE.InstancedBufferGeometry();
  sg.index = quad.index; sg.setAttribute("position", quad.attributes.position); sg.setAttribute("uv", quad.attributes.uv);
  const aPuff = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aLife = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 4), 4).setUsage(THREE.DynamicDrawUsage);
  sg.setAttribute("aPuff", aPuff); sg.setAttribute("aLife", aLife);
  sg.instanceCount = 0;
  const sunCol = new THREE.Color().copy(sunColor).multiplyScalar(0.9);
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tPuff: { value: puffTexture() }, uSun: { value: new THREE.Vector3(sunCol.r, sunCol.g, sunCol.b) }, uFog: { value: fog.color }, uFogD: { value: 0.0016 } },
    vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS,
  });
  const smoke = new THREE.Mesh(sg, smokeMat);
  smoke.frustumCulled = false; smoke.renderOrder = 7;
  scene.add(smoke);
  const P = [];
  for (let i = 0; i < MAXP; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 3, rot: 0, vr: 0, kind: 0, a: 1 });
  let head = 0;
  const emit = (pl) => {
    const p = P[head]; head = (head + 1) % MAXP;
    const black = pl.kind === "black";
    Object.assign(p, {
      life: 0, max: (pl.life || (black ? 9 : 6)) * (0.8 + Math.random() * 0.4), x: pl.x + (Math.random() - 0.5) * 0.8, y: pl.y, z: pl.z + (Math.random() - 0.5) * 0.8,
      vx: (Math.random() - 0.5) * 0.5, vy: pl.rise * (0.8 + Math.random() * 0.4), vz: (Math.random() - 0.5) * 0.5,
      s0: pl.size * 0.6, s1: pl.size * (black ? 5.5 : 3.6), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      kind: black ? 1 : 0, a: black ? 0.8 : 0.32,
    });
  };

  // ---------------------------------------------------------------- fires
  const FMAX = 48;
  const fireGeo = new THREE.ConeGeometry(0.5, 1.6, 7, 1, true).translate(0, 0.8, 0);
  const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff8a33").multiplyScalar(6), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const fireMesh = new THREE.InstancedMesh(fireGeo, fireMat, FMAX);
  fireMesh.frustumCulled = false; fireMesh.count = 0; fireMesh.renderOrder = 6;
  scene.add(fireMesh);
  const fireLights = [0, 1].map(() => { const l = new THREE.PointLight("#ff8a3a", 0, 18, 1.8); scene.add(l); return l; });
  // glow halos: one per drawn fire (the bloom pass picks them up at dusk)
  const gg = new THREE.InstancedBufferGeometry();
  gg.index = quad.index; gg.setAttribute("position", quad.attributes.position); gg.setAttribute("uv", quad.attributes.uv);
  const aG = new THREE.InstancedBufferAttribute(new Float32Array(FMAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aI = new THREE.InstancedBufferAttribute(new Float32Array(FMAX), 1).setUsage(THREE.DynamicDrawUsage);
  gg.setAttribute("aG", aG); gg.setAttribute("aI", aI); gg.instanceCount = 0;
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color("#ff7a2a") }, uGain: { value: 1 } },
    vertexShader: GLOW_VS, fragmentShader: GLOW_FS,
  });
  const glow = new THREE.Mesh(gg, glowMat);
  glow.frustumCulled = false; glow.renderOrder = 6;
  scene.add(glow);
  // embers: sparks rising from the fires nearest the camera, drifting downwind
  const EMAX = 220;
  const epos = new Float32Array(EMAX * 3), eage = new Float32Array(EMAX);
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.BufferAttribute(epos, 3).setUsage(THREE.DynamicDrawUsage));
  eg.setAttribute("aAge", new THREE.BufferAttribute(eage, 1).setUsage(THREE.DynamicDrawUsage));
  const emberMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 600 } },
    vertexShader: `attribute float aAge; uniform float uScale; varying float vA;
      void main() { vec4 mv = viewMatrix * vec4(position, 1.0); float d = max(-mv.z, 0.5);
        vA = (1.0 - aAge) * smoothstep(0.0, 0.1, aAge); gl_PointSize = clamp(0.07 * uScale / d, 1.0, 4.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(c)) * vA;
        gl_FragColor = vec4(vec3(4.0, 1.6, 0.45) * a, 1.0); }`,
  });
  const embers = new THREE.Points(eg, emberMat);
  embers.frustumCulled = false; embers.renderOrder = 6;
  scene.add(embers);
  const E = [];
  for (let i = 0; i < EMAX; i++) E.push({ life: 1, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ph: 0 });
  let ehead = 0;

  // ---------------------------------------------------------------- birds
  const body = new THREE.ConeGeometry(0.12, 0.9, 5).rotateX(Math.PI / 2);
  const wingL = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.25), new THREE.Vector3(-1.1, 0.05, 0.05), new THREE.Vector3(0, 0, 0.25), new THREE.Vector3(-1.1, 0.05, 0.05), new THREE.Vector3(-0.6, 0.02, 0.35), new THREE.Vector3(0, 0, 0.25)]);
  wingL.computeVertexNormals();
  const wingR = wingL.clone().scale(-1, 1, 1);
  const birdMat = new THREE.MeshStandardMaterial({ color: "#1d1915", roughness: 0.9, side: THREE.DoubleSide });
  const NB = flocks.reduce((s, f) => s + f.n, 0) || 1;
  const birdB = new THREE.InstancedMesh(body, birdMat, NB), birdL = new THREE.InstancedMesh(wingL, birdMat, NB), birdR = new THREE.InstancedMesh(wingR, birdMat, NB);
  for (const m of [birdB, birdL, birdR]) { m.frustumCulled = false; m.castShadow = false; scene.add(m); }
  const birds = [];
  for (const f of flocks) for (let i = 0; i < f.n; i++) birds.push({ f, a: Math.random() * 6.28, r: f.radius * (0.6 + Math.random() * 0.6), h: f.y + Math.random() * 25, w: (0.12 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 6.28, flap: 0 });

  let amount = 1, emberBudget = EMAX;
  const offQ = onQuality((q) => { amount = q.atmos ?? 1; dustMat.uniforms.uAmount.value = Math.min(1, amount); dust.geometry.setDrawRange(0, Math.floor(DUST * Math.min(1, amount))); emberBudget = Math.floor(EMAX * Math.min(1, amount)); });
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const offF = onFrame((cam, dt, time) => {
    if (!cam) return;
    dt = Math.min(dt, 0.1);
    tickWind(time);
    dustMat.uniforms.uTime.value = time;
    dustMat.uniforms.uCam.value.copy(cam.position);
    if (RC.renderer) emberMat.uniforms.uScale.value = dustMat.uniforms.uScale.value = RC.renderer.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    // smoke: emit near plumes within 900 m
    for (const pl of plumes) {
      const d2 = (pl.x - cam.position.x) ** 2 + (pl.z - cam.position.z) ** 2;
      if (d2 > pl.far * pl.far) continue;
      pl.acc += dt * pl.rate * Math.min(1.2, amount);
      while (pl.acc > 1) { pl.acc -= 1; emit(pl); }
    }
    let n = 0;
    const ws = WIND.speed * 0.42, wx = WIND.x * ws, wz = WIND.z * ws;
    for (const p of P) {
      if (p.life >= p.max) continue;
      p.life += dt;
      const k = p.life / p.max;
      p.x += (p.vx + wx * k) * dt; p.y += p.vy * dt * (1 - k * 0.6); p.z += (p.vz + wz * k) * dt; p.rot += p.vr * dt;
      aPuff.setXYZW(n, p.x, p.y, p.z, p.s0 + (p.s1 - p.s0) * Math.sqrt(k));
      aLife.setXYZW(n, k, p.rot, p.kind, p.a);
      n++;
    }
    sg.instanceCount = n;
    aPuff.needsUpdate = true; aLife.needsUpdate = true;
    // fires
    let fi = 0, li = 0, gi = 0;
    const lights = [];
    const dusk = !!sky && sky.mode === "dusk";
    for (const f of fires) {
      f.t += dt;
      const d2 = (f.x - cam.position.x) ** 2 + (f.z - cam.position.z) ** 2;
      if (d2 > 500 * 500 || fi >= FMAX - 3) continue;
      const fl = 0.75 + Math.sin(f.t * 13.1) * 0.12 + Math.sin(f.t * 29.7 + 1.1) * 0.08 + Math.sin(f.t * 5.3) * 0.05;
      aG.setXYZW(gi, f.x, f.y + f.size * 0.7, f.z, f.size * (dusk ? 5.5 : 3.6) * (0.92 + fl * 0.1));
      aI.setX(gi++, fl * (dusk ? 1.0 : 0.38));
      // embers from fires within 70 m
      if (d2 < 70 * 70 && Math.random() < dt * 6 * f.size * Math.min(1, amount)) {
        const e = E[ehead]; ehead = (ehead + 1) % emberBudget || 0;
        Object.assign(e, { life: 0, max: 1.2 + Math.random() * 1.6, x: f.x + (Math.random() - 0.5) * f.size * 0.6, y: f.y + f.size * 0.6, z: f.z + (Math.random() - 0.5) * f.size * 0.6,
          vx: (Math.random() - 0.5) * 0.8, vy: 1.6 + Math.random() * 2.2 * f.size, vz: (Math.random() - 0.5) * 0.8, ph: Math.random() * 6.28 });
      }
      for (let j = 0; j < 3; j++) {
        const fl = 1 + Math.sin(f.t * (11 + j * 3) + j) * 0.15 + Math.sin(f.t * 23 + j * 2) * 0.08;
        e.set(0, f.t * 0.7 + j * 2.1, Math.sin(f.t * 2 + j) * 0.12); qq.setFromEuler(e);
        m4.compose(v.set(f.x + (j - 1) * 0.3 * f.size, f.y, f.z + ((j * 7) % 3 - 1) * 0.25 * f.size), qq, one.set(f.size * (1 - j * 0.2), f.size * fl * (1 - j * 0.15), f.size * (1 - j * 0.2)));
        fireMesh.setMatrixAt(fi++, m4);
      }
      one.set(1, 1, 1);
      lights.push({ f, d2 });
    }
    fireMesh.count = fi; fireMesh.instanceMatrix.needsUpdate = true;
    gg.instanceCount = gi; aG.needsUpdate = true; aI.needsUpdate = true;
    let en = 0;
    const ewx = WIND.x * WIND.speed * 0.5, ewz = WIND.z * WIND.speed * 0.5;
    for (const e of E) {
      if (e.life >= e.max) continue;
      e.life += dt;
      e.ph += dt * 7;
      e.x += (e.vx + ewx + Math.sin(e.ph) * 0.4) * dt; e.y += e.vy * dt; e.z += (e.vz + ewz + Math.cos(e.ph * 0.8) * 0.4) * dt; e.vy *= 1 - dt * 0.35;
      epos[en * 3] = e.x; epos[en * 3 + 1] = e.y; epos[en * 3 + 2] = e.z; eage[en] = Math.min(1, e.life / e.max);
      en++;
    }
    eg.setDrawRange(0, en);
    eg.attributes.position.needsUpdate = true; eg.attributes.aAge.needsUpdate = true;
    lights.sort((a, b) => a.d2 - b.d2);
    for (const l of fireLights) {
      const c = lights[li++];
      if (!c || c.d2 > 120 * 120) { l.intensity = 0; continue; }
      l.position.set(c.f.x, c.f.y + 1.2, c.f.z);
      l.intensity = 30 * c.f.size * (0.85 + Math.sin(c.f.t * 17) * 0.15);
    }
    // birds
    birds.forEach((b, i) => {
      b.a += b.w * dt;
      b.ph += dt * (3.5 + Math.sin(b.a * 3) * 1.5);
      const flapK = Math.max(0, Math.sin(b.a * 2.3 + i)) ; // glide most of the time, flap in bursts
      const flap = Math.sin(b.ph * 2.2) * 0.55 * flapK;
      const x = b.f.x + Math.cos(b.a) * b.r, z = b.f.z + Math.sin(b.a) * b.r, y = b.h + Math.sin(b.a * 1.7) * 3;
      const heading = Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w));
      e.set(0, heading, -Math.sign(b.w) * 0.35); qq.setFromEuler(e);
      m4.compose(v.set(x, y, z), qq, one.set(1.4, 1.4, 1.4)); birdB.setMatrixAt(i, m4);
      e.set(0, heading, -Math.sign(b.w) * 0.35 + flap); qq.setFromEuler(e); m4.compose(v, qq, one); birdL.setMatrixAt(i, m4);
      e.set(0, heading, -Math.sign(b.w) * 0.35 - flap); qq.setFromEuler(e); m4.compose(v, qq, one); birdR.setMatrixAt(i, m4);
      one.set(1, 1, 1);
    });
    for (const m of [birdB, birdL, birdR]) { m.count = birds.length; m.instanceMatrix.needsUpdate = true; }
  }, scene);
  return {
    dispose() { offF(); offQ(); for (const o of [dust, smoke, fireMesh, glow, embers, birdB, birdL, birdR, ...fireLights]) o.removeFromParent(); },
    counts: () => ({ plumes: plumes.length, fires: fires.length, birds: birds.length }),
  };
}
