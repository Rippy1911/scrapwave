// The dust storm wall: two scrolling noise cylinders, layered billboard puffs riding the wall, rising fog
// near the camera, wind on every particle, orange-brown light and fog. setRadius(r, k) each frame; k = intensity.
import * as THREE from "three";
import { WIND } from "@/game/fx/particles";

function noiseTexture(seed) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 256, 128);
  let s = seed;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const x = R() * 256, y = R() * 128, r = 6 + R() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.08 + R() * 0.18;
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    for (const dx of [-256, 0, 256]) { g.save(); g.translate(dx, 0); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); }
  }
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(0,0,0,1)"); grad.addColorStop(0.35, "rgba(0,0,0,0)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function puffTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  for (let i = 0; i < 18; i++) {
    const x = 34 + Math.random() * 60, y = 34 + Math.random() * 60, r = 18 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function createStorm(game, center) {
  const { scene, particles, sky } = game;
  const root = new THREE.Group(); root.visible = false;
  root.position.set(center.x, 0, center.z);
  scene.add(root);
  const walls = [0, 1].map((i) => {
    const map = noiseTexture(11 + i * 7); map.repeat.set(18 + i * 6, 1);
    const mat = new THREE.MeshBasicMaterial({ color: i ? "#c08a52" : "#9a6a3c", map, alphaMap: map, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), mat);
    m.renderOrder = 4; root.add(m);
    return m;
  });
  const puffMap = puffTexture();
  const puffs = [];
  for (let i = 0; i < 90; i++) {
    const mat = new THREE.SpriteMaterial({ map: puffMap, color: i % 3 ? "#b98250" : "#8e5c34", transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    const s = new THREE.Sprite(mat);
    s.userData = { a: Math.random() * Math.PI * 2, h: Math.random(), sz: 40 + Math.random() * 70, sp: 0.01 + Math.random() * 0.02, off: (Math.random() - 0.5) * 30 };
    root.add(s); puffs.push(s);
  }
  const light = new THREE.HemisphereLight("#ff9a4a", "#5a3218", 0);
  scene.add(light);
  let radius = 2000, k = 0, t = 0;

  return {
    // r: wall radius around the Well-town; kk: storm strength 0..1 (0 hides everything).
    set(r, kk) { radius = r; k = kk; root.visible = kk > 0; },
    inside(x, z) { return k > 0 && Math.hypot(x - center.x, z - center.z) > radius; },
    update(dt, cam) {
      t += dt;
      if (k <= 0) { WIND.x = WIND.z = 0; light.intensity = 0; sky.setStorm(0); return 0; }
      const H = 140;
      walls.forEach((w, i) => {
        const rr = radius + i * 14;
        w.scale.set(rr, H * (1 - i * 0.25), rr); w.position.y = (H * (1 - i * 0.25)) / 2 - 6;
        w.material.map.offset.x = t * (i ? -0.004 : 0.006); w.material.map.offset.y = Math.sin(t * 0.2 + i) * 0.02;
        w.material.opacity = 0.85 * k;
      });
      for (const s of puffs) {
        const u = s.userData; u.a += u.sp * dt;
        s.position.set(Math.cos(u.a) * (radius + u.off), u.h * 100 + 10, Math.sin(u.a) * (radius + u.off));
        s.scale.setScalar(u.sz); s.material.opacity = 0.55 * k;
      }
      // Wind blows inward with a swirl, felt more inside the storm.
      const dx = cam.x - center.x, dz = cam.z - center.z, d = Math.hypot(dx, dz) || 1;
      const out = Math.max(0, Math.min(1, (d - radius + 60) / 120));
      const wind = 4 + 10 * out;
      WIND.x = (-dx / d * 0.6 - dz / d) * wind * k; WIND.z = (-dz / d * 0.6 + dx / d) * wind * k;
      const fogK = Math.min(1, out * k + k * 0.15);
      sky.setStorm(fogK);
      light.intensity = 0.9 * fogK;
      if (out > 0.2 && Math.random() < 0.9) for (let i = 0; i < 3; i++) particles.dust(cam.x + (Math.random() - 0.5) * 60, cam.y - 4 + Math.random() * 3, cam.z + (Math.random() - 0.5) * 60, WIND.x * 0.2, WIND.z * 0.2, 4 + Math.random() * 3);
      return out * k;
    },
    hide() { root.visible = false; k = 0; WIND.x = WIND.z = 0; light.intensity = 0; sky.setStorm(0); },
  };
}