// Build view, piece mode: ghost under the mouse, grid or fine placement with snapping and stacking, material and
// tier, rotate, copy / paste, undo / redo, remove. Keys: R rotate (90°, 15° in fine), F fine, 1-4 material,
// T tier, C copy the piece under the mouse, V paste it, X or Delete remove, Ctrl+Z undo, Ctrl+Y redo.
import * as THREE from "three";
import { PIECE_IDS, PIECE_CAP, isPiece, pieceStats, pieceDef } from "@/game/base/pieceCatalog";
import { MATERIAL_IDS } from "@/game/base/materials";
import { buildPiece } from "@/game/base/pieceMesh";
import { snapPlace, checkPlace } from "@/game/base/snap";
import { createHistory } from "@/game/base/buildHistory";

const okMat = new THREE.MeshBasicMaterial({ color: "#7fe0a0", transparent: true, opacity: 0.45, depthWrite: false });
const badMat = new THREE.MeshBasicMaterial({ color: "#ff4a2a", transparent: true, opacity: 0.4, depthWrite: false });

export function createPiecePlacer(game) {
  const base = game.base;
  const st = { sel: null, mat: "concrete", tier: 1, yaw: 0, fine: false, lx: 0, lz: 0, y0: 0, reason: null, hover: null };
  let ghost = null, ghostKey = "";
  const plot = () => game.buildView.plot;
  const hist = createHistory({
    add(spec) { const r = base.placePiece(spec); if (r.ok) spec.id = r.id; return !!r.ok; },
    del(spec) { const pc = base.pieces.byId.get(spec.id); return !!pc && base.removePiece(pc.id); },
  });

  function setGhost(valid) {
    const key = st.sel + valid;
    if (ghost && ghostKey === key) return;
    if (ghost) ghost.root.removeFromParent();
    ghost = buildPiece(st.sel, valid ? okMat : badMat); ghostKey = key;
    ghost.root.traverse((o) => { o.castShadow = false; o.renderOrder = 8; });
    game.scene.add(ghost.root);
  }
  function clearGhost() { if (ghost) ghost.root.removeFromParent(); ghost = null; ghostKey = ""; }
  const spec = () => ({ kind: st.sel, mat: st.mat, tier: st.tier, lx: st.lx, lz: st.lz, yaw: st.yaw });

  const pl = {
    st, history: hist,
    select(kind) { st.sel = isPiece(kind) && PIECE_IDS.includes(kind) ? kind : null; if (!st.sel) clearGhost(); return st.sel; },
    setMat(m) { if (MATERIAL_IDS.includes(m)) st.mat = m; return st.mat; },
    setTier(t) { st.tier = Math.max(1, Math.min(3, t | 0)); return st.tier; },
    rotate(dir = 1) { st.yaw = ((st.yaw + dir * (st.fine ? Math.PI / 12 : Math.PI / 2)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); },
    toggleFine() { st.fine = !st.fine; if (!st.fine) st.yaw = Math.round(st.yaw / (Math.PI / 2)) * (Math.PI / 2); return st.fine; },
    place() {
      if (!st.sel) return false;
      const s = spec(), r = base.placePiece(s);
      if (!r.ok) { game.audio.hitMarker(); return false; }
      hist.push("add", { ...s, id: r.id });
      return true;
    },
    erase() {
      const pc = st.hover;
      if (!pc) return false;
      const s = { kind: pc.kind, mat: pc.mat, tier: pc.tier, lx: pc.lx, lz: pc.lz, yaw: pc.yaw };
      if (!base.removePiece(pc.id)) return false;
      hist.push("del", s); st.hover = null;
      return true;
    },
    copy() { const c = hist.copy(st.hover); if (c) game.emit({ type: "minor", text: `COPIED ${pieceDef(c.kind).name.toUpperCase()}` }); return !!c; },
    paste() { const c = hist.paste(); if (!c) return false; st.sel = c.kind; st.mat = c.mat; st.tier = c.tier; st.yaw = c.yaw; return true; },
    undo: () => hist.undo(),
    redo: () => hist.redo(),
    onKey(e) {
      const k = e.code, ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && k === "KeyZ") { if (e.shiftKey) pl.redo(); else pl.undo(); return true; }
      if (ctrl && k === "KeyY") { pl.redo(); return true; }
      if (ctrl) return false;
      if (k === "KeyR" && st.sel) { pl.rotate(e.shiftKey ? -1 : 1); return true; }
      if (k === "KeyF") { pl.toggleFine(); return true; }
      if (k === "KeyT") { st.tier = (st.tier % 3) + 1; return true; }
      if (/^Digit[1-4]$/.test(k)) { st.mat = MATERIAL_IDS[+k.slice(5) - 1]; return true; }
      if (k === "KeyC") return pl.copy();
      if (k === "KeyV") return pl.paste();
      if (k === "KeyX" || k === "Delete") return pl.erase();
      return false;
    },
    // ray: the mouse ray; ground: its hit on the plot plane (or null).
    frame(ray, ground) {
      const p = plot();
      const h = game.world.colliders.raycast(ray.origin.x, ray.origin.y, ray.origin.z, ray.direction.x, ray.direction.y, ray.direction.z, 220);
      const hp = h && h.box.piece && h.box.piece.group === `plot:${p.id}` ? h.box.piece : null;
      st.hover = hp;
      if (!st.sel) { clearGhost(); return; }
      const at = h && hp ? ray.at(h.t, new THREE.Vector3()) : ground;
      if (!at) return;
      Object.assign(st, snapPlace(game, p, st.sel, at.x - p.x, at.z - p.z, st.yaw, st.fine));
      const r = base.pieces.restY(`plot:${p.id}`, st.sel, p.x + st.lx, p.z + st.lz, st.yaw);
      st.y0 = r.y;
      st.reason = checkPlace(game, p, st.sel, st.lx, st.lz, st.yaw, r.y, st.mat, st.tier);
      setGhost(!st.reason);
      ghost.root.position.set(p.x + st.lx, r.y + 0.03, p.z + st.lz);
      ghost.root.rotation.y = st.yaw;
    },
    close() { clearGhost(); st.hover = null; },
    hud() {
      const p = plot(), n = p ? base.pieces.group(`plot:${p.id}`).length : 0;
      const funds = base.pieceFunds(), hv = st.hover;
      return {
        sel: st.sel, mat: st.mat, tier: st.tier, deg: Math.round((st.yaw * 180) / Math.PI), fine: st.fine, count: n, cap: PIECE_CAP, world: base.pieces.list.length,
        reason: st.sel && st.reason ? base.pieceReason(st.reason) : null, funds, history: hist.state(), repair: base.repairCost(p),
        hover: hv ? { name: pieceDef(hv.kind).name, mat: hv.mat, tier: hv.tier, hp: Math.round(hv.hp), maxHp: hv.maxHp } : null,
        pieces: PIECE_IDS.map((id) => { const s = pieceStats(id, st.mat, st.tier); return { id, name: pieceDef(id).name, cost: s.cost, hp: s.hp, afford: funds >= s.cost }; }),
      };
    },
  };
  return pl;
}