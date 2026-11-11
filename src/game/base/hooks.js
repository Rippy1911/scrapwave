// window.scrapwake.base: test hooks for plots, building, raids, jobs, the convoy and the Warlord.
import { writeSave } from "@/game/core/save";
import { MODULE_IDS } from "@/game/base/modules";
import { pieceHooks } from "@/game/base/hooksPieces";

export function baseHooks(game) {
  const b = () => game.base;
  const mods = (plotId) => b().modules.forPlot(plotId).map((e) => ({ id: e.id, module: e.kind, x: e.x, z: e.z, rot: e.rot, hp: Math.round(e.hp), maxHp: e.maxHp }));
  return {
    ...pieceHooks(game),
    modules: MODULE_IDS,
    claim(plotId) { const p = b().plots.byId[plotId]; if (!p) return false; b().requestClaim(plotId); return true; },
    build(module, x = 0, z = 8, rot = 0) {
      const p = b().mine();
      if (!p) return "no plot";
      const r = b().validate(p, module, +x, +z, rot | 0);
      if (r) return r.reason || r;
      return b().requestBuild(p.id, module, +x, +z, rot | 0) ? "sent" : "rejected";
    },
    fund(n = 1000) { game.save.banked += Math.round(n); if (!game.noSave) writeSave(game.save); return game.save.banked; },
    raidNow() { return b().raids.raidNow(); },
    stamp() { return game.buildView.stamp(); },
    damageRig(dmg = 500) { const p = b().mine(), rig = p && b().modules.rigOf(p.id); if (!rig) return null; b().damage(rig, dmg, null, null); return Math.round(rig.hp); },
    openBuild() { return game.buildView.open(); },
    closeBuild() { game.buildView.close(); return true; },
    job(kind = "hunt") { const id = game.jobs.offerNow(kind); game.jobs.accept(); return id; },
    jobs: () => game.jobs.state(),
    convoy: () => game.convoy.spawnNow(),
    warlord: () => game.warlord.spawnNow(),
    state() {
      const p = b().mine();
      return {
        mine: p ? { id: p.id, name: p.name, stash: Math.floor(p.stash), dark: p.dark, modules: mods(p.id), raiders: b().raids.raiders(p.id), siphon: b().raids.hold(p.id) } : null,
        plots: b().plots.list.filter((x) => x.owner).map((x) => ({ id: x.id, owner: x.owner.name, ai: !!x.owner.ai, stash: Math.floor(x.stash), dark: x.dark, modules: b().modules.forPlot(x.id).length })),
        banked: Math.floor(game.save.banked), wallet: { ...b().wallet }, carried: game.player.scrap,
        buildView: game.buildView.active, alert: b().alert ? b().alert.text : null,
        convoy: game.convoy.active(), warlord: !!game.warlord.vehicle(), jobs: game.jobs.state(),
      };
    },
  };
}