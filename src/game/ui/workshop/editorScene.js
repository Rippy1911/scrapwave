// Three.js scene behind the free-build editor: the design built with the game's own mesh builder, shown in Drive
// or Walker mode (through the mech rig), a 0.25 m grid, a ghost of the part about to be placed, selection boxes,
// orbit / zoom, and picking that answers in the design's own frame (car body frame, or the walker frame).
import * as THREE from "three";
import { buildVehicleMesh } from "@/game/vehicles/build";
import { compileDesign } from "@/game/workshop/compile";
import { createRig } from "@/game/mech/rig";
import { partHalf } from "@/game/workshop/freeParts";

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), qi = new THREE.Quaternion();
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function createEditorScene(canvas, game) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight("#d7e0e8", "#6b4a30", 1.6));
  const sun = new THREE.DirectionalLight("#ffe2b8", 3); sun.position.set(6, 10, 5); scene.add(sun);
  scene.add(new THREE.GridHelper(16, 64, "#8a6a1e", "#3a3128"));
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: "#f2c230", transparent: true, opacity: 0.35, depthWrite: false }));
  ghost.visible = false; scene.add(ghost);
  const s = { mesh: null, rig: null, yaw: 0.8, pitch: 0.42, dist: 11, target: new THREE.Vector3(0, 1.2, 0), boxes: [] };
  let raf = 0;
  const loop = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) { renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
    const cp = Math.cos(s.pitch);
    cam.position.set(s.target.x + Math.sin(s.yaw) * cp * s.dist, s.target.y + Math.sin(s.pitch) * s.dist, s.target.z + Math.cos(s.yaw) * cp * s.dist);
    cam.lookAt(s.target);
    for (const b of s.boxes) b.update();
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const dropMesh = () => { if (!s.mesh) return; scene.remove(s.mesh.root); s.mesh.paintMat.dispose(); s.mesh.dmgTex.dispose(); s.mesh = null; s.rig = null; };
  const api = {
    // mode "drive" | "walk"; pose: preview joint values.
    setDesign(design, mode, pose) {
      dropMesh();
      const c = compileDesign(design), C = c.chassis;
      const mesh = buildVehicleMesh(c.id, { paint: c.design.paint, paint2: "#3a3734", loadout: c.loadout, armour: c.armour, armourHp: c.armourHp, ram: c.loadout.ram, plate: "WS-01", tiers: c.tune.weaponTiers, ramTier: c.tune.ramTier }, game.M, game.T);
      for (const m of mesh.dressDetail || []) m.visible = true;
      const hasPose = Object.values(pose || {}).some((x) => Math.abs(x) > 1e-4);
      if (mode === "walk" || (hasPose && c.design.free)) { s.rig = createRig(mesh, c.design); s.rig.apply(mode === "walk" ? 1 : 0, pose || {}); }
      mesh.root.position.y = mode === "walk" && s.rig ? s.rig.D.T.stance : Math.max(...C.wheels.map((w) => -(w.pos[1] - C.susLen / 2 + 0.15 - w.r)));
      scene.add(mesh.root);
      s.mesh = mesh;
      s.target.y = mode === "walk" ? 3 : 1;
      return c;
    },
    // -> { fid, at: [x,y,z] where a new part would go, hit: [x,y,z] } in the design frame, or null.
    pick(nx, ny) {
      if (!s.mesh) return null;
      ndc.set(nx * 2 - 1, -(ny * 2 - 1));
      ray.setFromCamera(ndc, cam);
      s.mesh.root.updateMatrixWorld(true);
      const body = s.mesh.body;
      const hits = ray.intersectObject(s.mesh.root, true).filter((h) => h.object.visible && h.face);
      body.getWorldQuaternion(qi).invert();
      if (hits.length) {
        const h = hits[0];
        let o = h.object; while (o.parent && o.parent !== body) o = o.parent;
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).applyQuaternion(qi);
        const p = body.worldToLocal(h.point.clone());
        return { fid: o.userData.fid || 0, hit: p.toArray(), at: p.addScaledVector(n, 0.25).toArray() };
      }
      const fp = ray.ray.intersectPlane(FLOOR, new THREE.Vector3());
      if (!fp) return null;
      const p = body.worldToLocal(fp.setY(0.25));
      return { fid: 0, hit: p.toArray(), at: p.toArray() };
    },
    ghost(at, type) {
      if (!at || !s.mesh) { ghost.visible = false; return; }
      const h = partHalf(type);
      ghost.scale.set(h[0] * 2, h[1] * 2, h[2] * 2);
      ghost.position.copy(s.mesh.body.localToWorld(new THREE.Vector3(...at)));
      ghost.visible = true;
    },
    highlight(fids) {
      for (const b of s.boxes) { scene.remove(b); b.dispose(); }
      s.boxes = [];
      if (!s.mesh) return;
      const set = new Set(fids);
      for (const o of s.mesh.body.children) if (set.has(o.userData.fid)) { const b = new THREE.BoxHelper(o, "#f2c230"); s.boxes.push(b); scene.add(b); }
    },
    orbit(dx, dy) { s.yaw -= dx * 0.008; s.pitch = Math.max(0.05, Math.min(1.45, s.pitch + dy * 0.006)); },
    zoom(d) { s.dist = Math.max(4, Math.min(30, s.dist * (d > 0 ? 1.1 : 0.9))); },
    dispose() { cancelAnimationFrame(raf); for (const b of s.boxes) b.dispose(); dropMesh(); renderer.dispose(); },
  };
  return api;
}