import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildVehicleMesh } from "@/game/vehicles/build";
import { compileDesign } from "@/game/workshop/compile";
import { BIKE } from "@/game/data/tuning";
import { buildWing } from "@/game/vehicles/wingMesh";

// 3D turntable of the design being built: the same mesh builder (and materials) the game's cars use.
export default function Turntable({ game, design }) {
  const ref = useRef(null), st = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200), pivot = new THREE.Group();
    scene.add(new THREE.HemisphereLight("#d7e0e8", "#6b4a30", 1.6), pivot);
    const sun = new THREE.DirectionalLight("#ffe2b8", 3.2); sun.position.set(6, 9, 5); scene.add(sun);
    const rim = new THREE.DirectionalLight("#9cc8ff", 1.2); rim.position.set(-6, 3, -6); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: "#2e2822", roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const s = { renderer, scene, cam, pivot, floor, mesh: null, dist: 8 };
    st.current = s;
    let raf = 0;
    const loop = (t) => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
      pivot.rotation.y = t * 0.00035;
      if (s.mesh) { for (const m of s.mesh.dressDetail || []) m.visible = true; for (const wh of s.mesh.wheels) { const hub = wh.spin.children[2]; if (hub) hub.visible = true; } }
      cam.position.set(s.dist * 0.82, s.dist * 0.42, s.dist * 0.82); cam.lookAt(0, 0.5, 0);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); if (s.mesh) { s.mesh.paintMat.dispose(); s.mesh.dmgTex.dispose(); } renderer.dispose(); };
  }, []);

  useEffect(() => {
    const s = st.current;
    if (!s || !game) return;
    if (s.mesh) { s.pivot.remove(s.mesh.root); s.mesh.paintMat.dispose(); s.mesh.dmgTex.dispose(); }
    const c = compileDesign(design), C = c.chassis;
    const mesh = buildVehicleMesh(c.id, { paint: c.design.paint, paint2: "#3a3734", loadout: c.loadout, armour: c.armour, armourHp: c.armourHp, ram: c.loadout.ram, plate: "WS-01", tiers: c.tune.weaponTiers, ramTier: c.tune.ramTier }, game.M, game.T);
    if (c.cls === "bike") for (const m of mesh.mounts) m.model.root.scale.setScalar(BIKE.turretScale);
    for (const w of c.tune.wings || []) mesh.body.add(buildWing(w, C, game.M, mesh.paintMat).obj);
    const ride = Math.max(...C.wheels.map((w) => -(w.pos[1] - C.susLen / 2 + 0.15 - w.r)));
    mesh.root.position.y = ride;
    s.pivot.add(mesh.root);
    s.mesh = mesh;
    s.dist = Math.max(4.5, C.hit.half[2] * 3.1 + 2);
  }, [design, game]);

  return <canvas ref={ref} className="h-full w-full" aria-label="3D preview of the car being built" />;
}