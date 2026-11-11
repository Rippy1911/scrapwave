// CPU particle pools rendered as soft round points: one additive (fire, sparks), one alpha-blended (smoke, dust).
import * as THREE from "three";
import { createBlastParts } from "@/game/fx/blastParts";

const VS = `
attribute float aSize; attribute vec4 aColor; varying vec4 vColor;
uniform float uScale;
void main(){
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying vec4 vColor;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d);
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

// Global wind (m/s) pushed onto every particle; the dust storm sets it.
export const WIND = { x: 0, z: 0 };

function pool(scene, max, additive) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 600 } },
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = additive ? 6 : 5;
  scene.add(pts);
  const P = [];
  for (let i = 0; i < max; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, c0: [1, 1, 1], c1: [1, 1, 1], a0: 1, a1: 0, grav: 0, drag: 0 });
  let head = 0;
  return {
    mat, budget: 1,
    emit(o) {
      const p = P[head]; head = (head + 1) % max;
      p.life = p.max = o.life || 1;
      p.x = o.x; p.y = o.y; p.z = o.z;
      p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
      p.s0 = o.s0 ?? 1; p.s1 = o.s1 ?? p.s0;
      p.c0 = o.c0 || [1, 1, 1]; p.c1 = o.c1 || p.c0;
      p.a0 = o.a0 ?? 1; p.a1 = o.a1 ?? 0;
      p.grav = o.grav || 0; p.drag = o.drag || 0;
    },
    update(dt) {
      let n = 0;
      for (let i = 0; i < max; i++) {
        const p = P[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) continue;
        const k = 1 - p.life / p.max;
        p.vy -= p.grav * dt;
        const d = 1 - p.drag * dt;
        p.vx *= d; p.vy *= d; p.vz *= d;
        p.x += (p.vx + WIND.x) * dt; p.y += p.vy * dt; p.z += (p.vz + WIND.z) * dt;
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
        col[n * 4] = p.c0[0] + (p.c1[0] - p.c0[0]) * k;
        col[n * 4 + 1] = p.c0[1] + (p.c1[1] - p.c0[1]) * k;
        col[n * 4 + 2] = p.c0[2] + (p.c1[2] - p.c0[2]) * k;
        col[n * 4 + 3] = p.a0 + (p.a1 - p.a0) * k;
        size[n] = p.s0 + (p.s1 - p.s0) * k;
        n++;
      }
      g.setDrawRange(0, n);
      g.attributes.position.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
    },
  };
}

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const FIRE = hex("#ffb347"), FIRE2 = hex("#b8300f"), SMOKE_W = hex("#cfc6b8"), DUST = hex("#c9a77c"), SPARK = hex("#ffe08a");
// Shared fire/smoke look: hot HDR core to orange flame; smoke lit orange from below that cools to grey-brown.
const HOT = [7, 4.6, 2.2], FLAME = [3.4, 1.5, 0.45], LIT = hex("#9a5a2e"), SMOKE_BROWN = hex("#4a4038"), SMOKE_DARK = hex("#2c2621");

export function createParticles(scene, groundAt = (x, z, y) => y - 1) {
  const add = pool(scene, 2500, true), alpha = pool(scene, 3000, false);
  const parts = createBlastParts(scene, groundAt);
  const R = Math.random;
  let budget = 1;
  const ok = () => R() < budget;
  return {
    setBudget(b) { budget = b; },
    setScale(h) { add.mat.uniforms.uScale.value = h; alpha.mat.uniforms.uScale.value = h; },
    update(dt) { add.update(dt); alpha.update(dt); parts.update(dt); },
    smoke(x, y, z, dark = true, size = 1.6) {
      if (!ok()) return;
      if (!dark) { alpha.emit({ x, y, z, vx: (R() - 0.5) * 1.2, vy: 1.6 + R(), vz: (R() - 0.5) * 1.2, life: 1.6 + R(), s0: size, s1: size * 3.5, c0: SMOKE_W, a0: 0.35, a1: 0, drag: 0.6 }); return; }
      alpha.emit({ x, y, z, vx: (R() - 0.5) * 1.2, vy: 1.8 + R(), vz: (R() - 0.5) * 1.2, life: 2 + R(), s0: size, s1: size * 4, c0: LIT, c1: SMOKE_DARK, a0: 0.65, a1: 0, drag: 0.6 });
    },
    dust(x, y, z, vx = 0, vz = 0, size = 2) {
      if (!ok()) return;
      alpha.emit({ x, y, z, vx: vx * 0.2 + (R() - 0.5) * 2, vy: 0.6 + R(), vz: vz * 0.2 + (R() - 0.5) * 2, life: 1 + R() * 0.8, s0: size, s1: size * 3, c0: DUST, a0: 0.35, a1: 0, drag: 1.2 });
    },
    fire(x, y, z, size = 1.2) {
      if (!ok()) return;
      add.emit({ x: x + (R() - 0.5) * 0.4, y, z: z + (R() - 0.5) * 0.4, vx: (R() - 0.5), vy: 2 + R() * 2, vz: (R() - 0.5), life: 0.4 + R() * 0.3, s0: size, s1: size * 0.3, c0: R() < 0.3 ? HOT : FLAME, c1: FIRE2, a0: 0.9, a1: 0 });
    },
    sparks(x, y, z, n = 8, nx = 0, ny = 1, nz = 0) {
      for (let i = 0; i < n * budget; i++) add.emit({ x, y, z, vx: nx * 6 + (R() - 0.5) * 10, vy: ny * 6 + R() * 5, vz: nz * 6 + (R() - 0.5) * 10, life: 0.3 + R() * 0.4, s0: 0.25, s1: 0.05, c0: SPARK, c1: FIRE2, a0: 1, a1: 0.3, grav: 15 });
    },
    muzzle(x, y, z, size = 0.8) { add.emit({ x, y, z, life: 0.05, s0: size, s1: size * 1.6, c0: SPARK, a0: 1, a1: 0.4 }); },
    trail(x, y, z) { alpha.emit({ x, y, z, vx: (R() - 0.5) * 0.4, vy: 0.4, vz: (R() - 0.5) * 0.4, life: 0.9, s0: 0.5, s1: 1.8, c0: SMOKE_W, a0: 0.4, a1: 0 }); add.emit({ x, y, z, life: 0.08, s0: 0.7, s1: 0.2, c0: FIRE }); },
    turbo(x, y, z) { add.emit({ x, y, z, vx: (R() - 0.5), vy: 0.3, vz: (R() - 0.5), life: 0.12, s0: 0.6, s1: 0.1, c0: hex("#9cc8ff"), a0: 0.8 }); },
    // Fireball core + streak sparks + chunks + shock ring (pooled meshes), flame licks, ground dust, rising smoke.
    explosion(x, y, z, scale = 1) {
      const s = Math.max(0.25, scale), r = Math.sqrt(s);
      parts.burst(x, y, z, s, budget);
      for (let i = 0; i < 16 * s * budget; i++) {
        const a = R() * 6.28, e = R() * 1.2, sp = (3 + R() * 6) * r;
        add.emit({ x: x + (R() - 0.5) * r, y: y + R() * r, z: z + (R() - 0.5) * r, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 1.5, vz: Math.sin(a) * Math.cos(e) * sp, life: 0.25 + R() * 0.35 * r, s0: 2.4 * r, s1: 4.2 * r, c0: i % 3 ? FLAME : HOT, c1: FIRE2, a0: 1, a1: 0, drag: 4 });
      }
      const gy = groundAt(x, z, y + 1);
      if (y - gy < 3 + 2 * r) for (let i = 0; i < 14 * s * budget; i++) {
        const a = R() * 6.28, sp = (7 + R() * 5) * r;
        alpha.emit({ x, y: gy + 0.4, z, vx: Math.cos(a) * sp, vy: 0.3 + R() * 0.6, vz: Math.sin(a) * sp, life: 1 + R() * 0.6 * r, s0: 1.6 * r, s1: 5 * r, c0: DUST, a0: 0.5, a1: 0, drag: 2.4 });
      }
      for (let i = 0; i < 18 * s * budget; i++) {
        alpha.emit({ x: x + (R() - 0.5) * 2 * r, y: y + R() * r, z: z + (R() - 0.5) * 2 * r, vx: (R() - 0.5) * 3 * r, vy: 1.5 + R() * 2.5 * r, vz: (R() - 0.5) * 3 * r, life: 2.4 + R() * 2 * r, s0: 2 * r, s1: 8.5 * r, c0: LIT, c1: SMOKE_BROWN, a0: 0.8, a1: 0, drag: 1.1, grav: -0.5 });
      }
      this.sparks(x, y + 0.5, z, 6 * r);
    },
  };
}