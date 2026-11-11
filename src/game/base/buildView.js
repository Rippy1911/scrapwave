// Build view: B on your own plot. Top-down camera over the plot, a 2 m grid, a ghost that follows the mouse,
// R rotates, left click asks the net to build, right click cancels, Esc leaves. "Stamp blueprint" re-places
// last cycle's layout; what you cannot afford stays as ghost outlines.
import * as THREE from "three";
import { BASE } from "@/game/data/tuning";
import { buildModel, ghostMaterials } from "@/game/base/models";
import { footprint, moduleDef, MODULE_IDS } from "@/game/base/modules";
import { createPiecePlacer } from "@/game/base/piecePlacer";
import { isPiece } from "@/game/base/pieceCatalog";

const HALF = BASE.plotSize / 2, GRID = BASE.grid;
const snap = (v, size) => (size >= GRID ? Math.round((v - size / 2) / GRID) * GRID + size / 2 : Math.floor(v / GRID) * GRID + GRID / 2);

import { buildTouch } from "@/game/base/buildTouch";

export function createBuildView(game) {
  const { scene, camera } = game, base = game.base;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const ok = ghostMaterials("#7fe0a0", 0.5), bad = ghostMaterials("#ff4a2a", 0.45), outline = ghostMaterials("#f2c230", 0.35, true);
  const bv = { active: false, plot: null, sel: null, rot: 0, x: 0, z: 0, valid: null, outlines: [] };
  let grid = null, ghost = null, ghostOk = null, camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  function makeGrid(p) {
    const pts = [];
    for (let i = -HALF; i <= HALF; i += GRID) pts.push(i, 0, -HALF, i, 0, HALF, -HALF, 0, i, HALF, 0, i);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#f2c230", transparent: true, opacity: 0.28, depthWrite: false }));
    lines.position.set(p.x, p.y + 0.2, p.z);
    scene.add(lines);
    return lines;
  }
  function clearGhost() { if (ghost) ghost.root.removeFromParent(); ghost = null; ghostOk = null; }
  function setGhost(kind, valid) {
    if (ghost && ghost.kind === kind && ghostOk === valid) return;
    clearGhost();
    ghost = buildModel(kind, (valid ? ok : bad).set); ghost.kind = kind; ghostOk = valid;
    ghost.root.traverse((o) => { o.castShadow = false; o.renderOrder = 8; });
    scene.add(ghost.root);
  }
  function clearOutlines() { for (const o of bv.outlines) o.model.root.removeFromParent(); bv.outlines = []; }

  bv.pieces = createPiecePlacer(game); // free-build pieces (walls, ramps, towers...) next to the modules
  const gHit = new THREE.Vector3();
  function onDown(e) {
    if (!bv.active || e.target !== game.rend.renderer.domElement) return;
    if (e.button === 2) { bv.sel = null; clearGhost(); bv.pieces.select(null); return; }
    if (e.button === 0 && bv.pieces.st.sel) bv.pieces.place();
    else if (e.button === 0 && bv.sel) place();
  }
  function onKey(e) {
    if (!bv.active || e.repeat || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (bv.pieces.onKey(e)) { e.preventDefault(); return; }
    if (e.code === "KeyR") bv.rot = (bv.rot + 1) & 3;
  }
  window.addEventListener("mousedown", onDown);
  window.addEventListener("keydown", onKey);
  const touch = buildTouch(game, bv, () => { if (bv.pieces.st.sel) bv.pieces.place(); else if (bv.sel) place(); });

  function place() {
    const r = base.validate(bv.plot, bv.sel, bv.x, bv.z, bv.rot);
    if (r) { base.no(r.reason || r, r); game.audio.hitMarker(); return; }
    base.requestBuild(bv.plot.id, bv.sel, bv.x, bv.z, bv.rot);
  }

  bv.open = () => {
    const p = base.mine(), v = game.player;
    if (!p || p.dark || !v.alive || !base.plots.inside(p, v.pos.x, v.pos.z)) return false;
    bv.active = true; bv.plot = p;
    grid = makeGrid(p);
    camPos.copy(camera.position); camLook.set(p.x, p.y, p.z);
    if (document.pointerLockElement) document.exitPointerLock();
    game.emit({ type: "buildView", on: true });
    return true;
  };
  bv.close = () => {
    if (!bv.active) return;
    bv.active = false;
    clearGhost(); clearOutlines(); bv.pieces.close();
    if (grid) { grid.removeFromParent(); grid.geometry.dispose(); grid = null; }
    game.cam.snap(game.player);
    game.emit({ type: "buildView", on: false });
  };
  bv.select = (kind) => {
    bv.pieces.select(isPiece(kind) ? kind : null);
    bv.sel = MODULE_IDS.includes(kind) ? kind : null;
    if (!bv.sel) clearGhost();
  };

  bv.stamp = () => {
    const p = bv.plot || base.mine(), list = base.lastLayout();
    if (!p || !list.length) { base.no("No blueprint from last cycle"); return 0; }
    clearOutlines();
    let budget = base.bankAvail() + p.stash, n = 0;
    for (const it of list) {
      const def = moduleDef(it.module);
      const r = base.validate(p, it.module, it.x, it.z, it.rot);
      const reason = r && (r.reason || r);
      if (reason && reason !== "scrap") continue; // already built or no longer fits
      if (!reason && budget >= def.cost && base.requestBuild(p.id, it.module, it.x, it.z, it.rot)) { budget -= def.cost; n++; continue; }
      const model = buildModel(it.module, outline.set);
      model.root.position.set(p.x + it.x, p.y, p.z + it.z); model.root.rotation.y = it.rot * Math.PI / 2;
      scene.add(model.root);
      bv.outlines.push({ ...it, model });
    }
    game.emit({ type: "minor", text: `BLUEPRINT: ${n} PLACED · ${bv.outlines.length} TOO PRICEY` });
    return n;
  };

  // Per render frame while active: camera, mouse ghost.
  bv.frame = (dt) => {
    if (!bv.active) return false;
    const p = bv.plot;
    if (!p.owner || p.owner.id !== game.selfId() || p.dark || !game.player.alive) { bv.close(); return false; }
    const k = Math.min(1, dt * 4);
    camPos.lerp(hit.set(p.x, p.y + 74, p.z + 30), k);
    camera.position.copy(camPos); camera.lookAt(camLook);
    camera.updateMatrixWorld();
    const a = game.input.a;
    ndc.set(a.mouseX * 2 - 1, -(a.mouseY * 2 - 1));
    ray.setFromCamera(ndc, camera);
    plane.constant = -p.y;
    bv.pieces.frame(ray.ray, ray.ray.intersectPlane(plane, gHit));
    if (bv.sel && ray.ray.intersectPlane(plane, hit)) {
      const [w, d] = footprint(bv.sel, bv.rot);
      bv.x = Math.max(-HALF + w / 2, Math.min(HALF - w / 2, snap(hit.x - p.x, w)));
      bv.z = Math.max(-HALF + d / 2, Math.min(HALF - d / 2, snap(hit.z - p.z, d)));
      bv.valid = base.validate(p, bv.sel, bv.x, bv.z, bv.rot);
      setGhost(bv.sel, !bv.valid);
      ghost.root.position.set(p.x + bv.x, game.world.terrain.heightAt(p.x + bv.x, p.z + bv.z) + 0.05, p.z + bv.z);
      ghost.root.rotation.y = bv.rot * Math.PI / 2;
    }
    for (let i = bv.outlines.length - 1; i >= 0; i--) {
      const o = bv.outlines[i];
      if (base.modules.forPlot(p.id).some((e) => e.kind === o.module && e.x === o.x && e.z === o.z)) { o.model.root.removeFromParent(); bv.outlines.splice(i, 1); }
    }
    touch.frame(); // a finger lifted: place where the ghost stands
    return true;
  };

  bv.hud = () => {
    if (!bv.active) return null;
    const p = bv.plot, bank = Math.floor(base.bankAvail()), stash = Math.floor(p.stash);
    const reason = bv.valid ? (bv.valid.reason || bv.valid) : null;
    return {
      sel: bv.sel, rot: bv.rot, bank, stash, plot: p.name, count: base.modules.forPlot(p.id).length - 1, outlines: bv.outlines.length,
      canStamp: base.lastLayout().length > 0, reason, pieces: bv.pieces.hud(), blueprints: base.blueprints.list(), msg: base.msg && game.time - base.msg.t < 3 ? base.msg.text : null,
      modules: MODULE_IDS.map((id) => { const d = moduleDef(id); return { id, name: d.name, cost: d.cost, hp: d.hp, afford: bank + stash >= d.cost }; }),
    };
  };
  bv.dispose = () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); touch.dispose(); };
  return bv;
}