// Oil slick look: a dark glossy pool with a rainbow sheen (one shared canvas texture), and a burning state
// that tints it orange and throws fire particles. Used by dropped slicks and the world's oil spots.
import * as THREE from "three";

let tex = null;
function sheenTexture() {
  if (tex) return tex;
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const base = g.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  base.addColorStop(0, "rgba(8,7,10,0.95)"); base.addColorStop(0.75, "rgba(12,10,14,0.88)"); base.addColorStop(1, "rgba(12,10,14,0)");
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  // rainbow film: soft coloured bands swirled over the pool
  g.globalCompositeOperation = "lighter";
  const hues = [200, 280, 330, 40, 120, 180];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 30 + (i % 3) * 22;
    const x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r * 0.8;
    const rg = g.createRadialGradient(x, y, 2, x, y, 46);
    rg.addColorStop(0, `hsla(${hues[i % hues.length]},80%,55%,0.22)`); rg.addColorStop(1, "hsla(0,0%,0%,0)");
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
  }
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const disc = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);

export function makeSlickMesh(scene, x, y, z, r) {
  const mat = new THREE.MeshBasicMaterial({ map: sheenTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, color: "#ffffff" });
  const m = new THREE.Mesh(disc, mat);
  m.position.set(x, y + 0.05, z);
  m.scale.set(r, 1, r * (0.8 + Math.random() * 0.25));
  m.rotation.y = Math.random() * Math.PI * 2;
  m.renderOrder = 2;
  scene.add(m);
  return m;
}

// Per render frame: fade in/out, flicker and flames while burning.
export function animateSlick(game, s, dt) {
  const m = s.mesh, mat = m.material;
  const fade = Math.min(1, s.life / 2, s.age * 3 + 0.2);
  mat.opacity = fade;
  if (s.burnT > 0) {
    mat.color.setRGB(1, 0.55 + Math.random() * 0.15, 0.25);
    const n = Math.max(1, Math.round(s.r * 1.4 * dt * 30));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * s.r * 0.9;
      game.particles.fire(s.x + Math.cos(a) * d, s.y + 0.3, s.z + Math.sin(a) * d, 1.1);
    }
    if (Math.random() < dt * 4) game.particles.smoke(s.x, s.y + 1, s.z, false, 2);
  } else mat.color.setRGB(s.burnt ? 0.45 : 1, s.burnt ? 0.42 : 1, s.burnt ? 0.4 : 1);
}