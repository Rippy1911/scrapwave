// Arena checkpoints: glowing rings to pass in order. The next ring is bright with a light beam, the one after
// it is dim, the rest wait hidden. Pass = within 7 m across and 7 m up/down of the ring centre.
import * as THREE from "three";

const ringGeo = new THREE.TorusGeometry(4.2, 0.28, 8, 32);
const beamGeo = new THREE.CylinderGeometry(0.6, 0.6, 40, 8, 1, true).translate(0, 20, 0);

export function createCheckpoints(game) {
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color("#f2c230").multiplyScalar(4), toneMapped: true });
  const dim = new THREE.MeshBasicMaterial({ color: new THREE.Color("#8a7a5a"), transparent: true, opacity: 0.55 });
  const group = new THREE.Group();
  game.scene.add(group);
  let pts = [], rings = [], beam = null, next = 0, t = 0;

  function set(points) {
    clear();
    pts = points;
    rings = pts.map((p, i) => {
      const m = new THREE.Mesh(ringGeo, dim);
      const q = pts[(i + 1) % pts.length];
      m.position.set(p.x, p.y + 3.2, p.z);
      m.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      group.add(m);
      return m;
    });
    beam = new THREE.Mesh(beamGeo, game.M.beam);
    group.add(beam);
    next = 0;
    show();
  }
  function show() {
    rings.forEach((m, i) => { m.visible = i === next || i === next + 1; m.material = i === next ? hot : dim; });
    beam.visible = next < pts.length;
    if (next < pts.length) beam.position.set(pts[next].x, pts[next].y, pts[next].z);
  }
  // Returns true when the player passed the next ring this step.
  function step(p) {
    if (next >= pts.length || !p.alive) return false;
    const c = pts[next];
    if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > 7 || Math.abs(p.pos.y - (c.y + 3)) > 7) return false;
    next++;
    show();
    return true;
  }
  function frame(dt) {
    t += dt;
    const m = rings[next];
    if (m) m.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
  }
  function clear() { group.clear(); pts = []; rings = []; beam = null; next = 0; }
  return {
    set, step, frame, clear,
    get next() { return next; }, get total() { return pts.length; },
    target: () => (next < pts.length ? pts[next] : null),
  };
}