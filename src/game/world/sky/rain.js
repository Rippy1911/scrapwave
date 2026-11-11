// Rain: short streaks in a box that follows the camera, slanted by the wind (round 14). k = 0 hides it.
import * as THREE from "three";
import { WIND } from "@/game/render/wind";

const BOX = 46, TOP = 26, FALL = 34, LEN = 1.1;

export function createRain(scene, count = 1200) {
  const pos = new Float32Array(count * 6), drops = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { drops[i * 3] = (Math.random() - 0.5) * BOX; drops[i * 3 + 1] = Math.random() * TOP; drops[i * 3 + 2] = (Math.random() - 0.5) * BOX; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xb4c0cc, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  return {
    update(camPos, dt, k) {
      lines.visible = k > 0.03;
      if (!lines.visible) return;
      const n = Math.round(count * Math.min(1, 0.35 + k * 0.65));
      const sx = WIND.x * WIND.speed * 0.45, sz = WIND.z * WIND.speed * 0.45; // sideways drift, m/s
      const lx = (sx / FALL) * LEN, lz = (sz / FALL) * LEN;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        drops[j] += sx * dt; drops[j + 1] -= FALL * dt; drops[j + 2] += sz * dt;
        if (drops[j + 1] < -4) { drops[j] = (Math.random() - 0.5) * BOX; drops[j + 1] = TOP; drops[j + 2] = (Math.random() - 0.5) * BOX; }
        const x = camPos.x + drops[j], y = camPos.y - 6 + drops[j + 1], z = camPos.z + drops[j + 2], o = i * 6;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        pos[o + 3] = x - lx; pos[o + 4] = y + LEN; pos[o + 5] = z - lz;
      }
      geo.setDrawRange(0, n * 2);
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 0.16 + 0.26 * Math.min(1, k);
    },
    dispose() { lines.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}