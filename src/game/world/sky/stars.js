// Night sky: a dome of stars that follows the camera and fades in as the sun goes down (round 14).
import * as THREE from "three";

export function createStars(scene, count = 900) {
  const pos = new Float32Array(count * 3);
  let s = 90210;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647); // fixed seed: the same sky every night
  for (let i = 0; i < count; i++) {
    const y = 0.04 + R() * 0.96, a = R() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(a) * r * 1400; pos[i * 3 + 1] = y * 1400; pos[i * 3 + 2] = Math.sin(a) * r * 1400;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  scene.add(pts);
  return {
    // k: 0 (day) .. 1 (clear night)
    update(camPos, k) {
      pts.visible = k > 0.02;
      if (!pts.visible) return;
      pts.position.copy(camPos);
      mat.opacity = Math.min(1, k) * 0.9;
    },
    dispose() { pts.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}