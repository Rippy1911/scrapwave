// window.scrapwake.aim and .traps — round 8 test hooks (assisted aim, trap slot, trap tiers), plus arena opponents.
import * as THREE from "three";
import { writeSave } from "@/game/core/save";
import { elevationDeg } from "@/game/weapons/aimLimits";
import { ownedTier, trapProgress } from "@/game/traps/tiers";

export function aimTrapHooks(game) {
  const p = () => game.player;
  return {
    // aim.mode() / setMode("assisted"|"manual"); lock() → { id, kind, distance, inRange, lockT } | null;
    // rocketReady(); candidates() → what the cone sees right now, best first.
    aim: {
      mode: () => game.playerAim.mode(),
      // Round 14: pitch() → where the guns point above level right now, the limits, and the camera's aim-up
      // fraction; pitch(k) sets that fraction (0 level .. 1 fully up) first, as pushing the mouse up does.
      pitch: (k) => {
        if (typeof k === "number") game.cam.aimUp = Math.max(0, Math.min(1, k));
        const v = p(), w = v.weapons.find((x) => !x.disabled && x.mount && x.mount.model);
        const from = w ? w.mount.model.pitch.getWorldPosition(new THREE.Vector3()) : v.pos.clone();
        return { deg: elevationDeg(v.aimPoint.clone().sub(from)), mountDeg: w ? Math.round(w.mount.model.pitch.rotation.x * 573) / 10 : null, aimUp: +game.cam.aimUp.toFixed(2), maxUp: 35, maxDown: 20 };
      },
      setMode: (m) => game.playerAim.setMode(m),
      lock: () => game.playerAim.lock(),
      rocketReady: () => game.playerAim.assist.rocketReady(),
      candidates: () => game.playerAim.assist.st.list.map((e) => ({ id: e.c.id, kind: e.c.kind, dist: Math.round(e.dist), score: +e.score.toFixed(2) })),
    },
    // traps.list() → every slick, strip and mine; slot() → the player's charges/selection; drop(kind?) lays one;
    // tier() → { owned, inForce, progress }; setTier(1-3); setProgress(n); refill(); flat() → popped tyres.
    traps: {
      list: () => game.traps.list(),
      slot: () => { const s = game.traps.slot(p()); return { sel: s.sel, charges: { ...s.charges }, cd: +s.cd.toFixed(2) }; },
      drop: (kind = null) => game.traps.drop(p(), kind),
      cycle: () => game.traps.cycle(p()),
      tier: () => ({ owned: ownedTier(game.save), inForce: game.traps.hud()?.tier || null, progress: trapProgress(game.save) }),
      setTier(n) { game.save.trapTier = Math.max(1, Math.min(3, n | 0)); if (!game.noSave) writeSave(game.save); p().trapSt = null; return ownedTier(game.save); },
      setProgress(n) { game.save.trapProgress = Math.max(0, n | 0); return trapProgress(game.save); },
      refill: () => game.traps.refill(p()),
      flat: () => p().flat || null,
      clear: () => { game.traps.clearDropped(); return game.traps.list().length; },
    },
    // Arena opponents: name, skill tier, alive, reaction time of their current aim.
    arenaOpponents: () => (game.arena.active ? game.arena.opponents.list() : []),
  };
}