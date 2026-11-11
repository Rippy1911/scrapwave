// window.scrapwake.base piece, blueprint and fortress hooks (merged into baseHooks).
import * as THREE from "three";
import { baseCheck } from "@/game/base/check";

export function pieceHooks(game) {
  const b = () => game.base;
  const info = (pc) => ({ id: pc.id, kind: pc.kind, mat: pc.mat, tier: pc.tier, lx: pc.lx, lz: pc.lz, y: +pc.y0.toFixed(2), hp: Math.round(pc.hp), maxHp: pc.maxHp, falling: !!pc.fall });
  return {
    // pieces(group?): your plot's pieces, or any group ("fort:rustjaw").
    pieces(group) { const p = b().mine(); const g = group || (p && `plot:${p.id}`); return g ? b().pieces.group(g).map(info) : []; },
    // place({ kind, mat, tier, lx, lz, yaw (deg) }, free) on your plot.
    place(s = {}, free = false) { return b().placePiece({ kind: "wall", mat: "concrete", tier: 1, lx: 0, lz: 10, ...s, yaw: ((s.yaw || 0) * Math.PI) / 180 }, { free, quiet: true }); },
    remove: (id) => b().removePiece(id),
    hitPiece(id, amount = 100, kind = "rocket") { const pc = b().pieces.byId.get(id); return pc ? +b().pieces.damage(pc, amount, kind, null, game.player).toFixed(2) : null; },
    blast(x, z, dmg = 80, weapon = "rockets") { game.combat.explode(new THREE.Vector3(x, game.world.terrain.heightAt(x, z) + 1, z), 6, dmg, game.player, 1, null, weapon); return true; },
    repair: () => b().repairPieces(),
    repairCost: () => b().repairCost(),
    blueprints: {
      list: () => b().blueprints.list(), save: (n) => b().blueprints.save(n), load: (n, free = false) => b().blueprints.load(n, { free }),
      rename: (a, c) => b().blueprints.rename(a, c), remove: (n) => b().blueprints.remove(n), missing: (n) => b().blueprints.missing(n),
      exportCode: (n) => b().blueprints.exportCode(n), importCode: (c, n) => b().blueprints.importCode(c, n),
    },
    forts: () => b().forts.state(),
    breakFort(id) { const f = b().forts.state().find((x) => x.id === id) || b().forts.state().find((x) => x.state === "standing"); if (!f) return null; const c = f && f.core && b().pieces.byId.get(f.core.id); if (c) b().pieces.damage(c, 1e6, "rocket", null, game.player); return b().forts.state().find((x) => x.id === f.id); },
    rebuildFort(id) { const f = b().forts.list.find((x) => x.id === id) || b().forts.list[0]; b().forts.build(f); return b().forts.state().find((x) => x.id === f.id); },
    check: () => baseCheck(game),
  };
}