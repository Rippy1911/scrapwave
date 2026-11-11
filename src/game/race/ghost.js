// The ghost of your best lap: records where your car is 8 times a second through a lap, and replays a see-through
// copy of the car along the best lap's recording. It is looks only: no collider, nothing can hit it.
import * as THREE from "three";

const HZ = 8, N = 7; // per sample: x, y, z (cm) and the rotation (x1000)
const a = new THREE.Quaternion(), b = new THREE.Quaternion();

export function createGhost(game) {
  const mat = new THREE.MeshBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0.3, depthWrite: false });
  let rec = [], play = null, mesh = null;

  function drop() { if (mesh) game.scene.remove(mesh); mesh = null; play = null; }

  return {
    /** Start recording a new lap. */
    begin() { rec = []; },
    /** Every step of the lap: lapT seconds into it. */
    sample(lapT, v) {
      const p = v.mesh.root.position, q = v.mesh.root.quaternion;
      while (lapT >= rec.length / N / HZ) rec.push(Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), Math.round(q.x * 1000), Math.round(q.y * 1000), Math.round(q.z * 1000), Math.round(q.w * 1000));
    },
    /** The lap just recorded, for saving with a best lap. */
    take: () => ({ hz: HZ, data: rec.slice() }),
    /** Replay `ghost` ({ hz, data }) as a see-through copy of car v. */
    show(ghost, v) {
      drop();
      if (!ghost || !ghost.data || ghost.data.length < N * 2) return;
      mesh = v.mesh.root.clone(true);
      mesh.traverse((o) => {
        if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; }
        else if (o.isSprite || o.isLight || o.isPoints || o.isLine) o.visible = false;
      });
      mesh.visible = false;
      game.scene.add(mesh);
      play = ghost;
    },
    /** Every frame: put the ghost where the best lap was lapT seconds in (hidden once that lap is over). */
    frame(lapT) {
      if (!mesh) return;
      const d = play.data, u = lapT * play.hz, i = Math.floor(u), f = u - i, o = i * N;
      mesh.visible = lapT >= 0 && o + 2 * N <= d.length;
      if (!mesh.visible) return;
      mesh.position.set(d[o] + (d[o + N] - d[o]) * f, d[o + 1] + (d[o + N + 1] - d[o + 1]) * f, d[o + 2] + (d[o + N + 2] - d[o + 2]) * f).multiplyScalar(0.01);
      a.set(d[o + 3], d[o + 4], d[o + 5], d[o + 6]).normalize();
      b.set(d[o + N + 3], d[o + N + 4], d[o + N + 5], d[o + N + 6]).normalize();
      mesh.quaternion.copy(a).slerp(b, f);
    },
    /** Where the ghost is now, for the lap map (null when hidden). */
    pos: () => (mesh && mesh.visible ? { x: mesh.position.x, z: mesh.position.z } : null),
    hide() { if (mesh) mesh.visible = false; },
    dispose() { drop(); mat.dispose(); },
  };
}