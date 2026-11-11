// window.scrapwake.air and window.scrapwake.admin — test hooks for aircraft and the admin flag.
import { setDevAdmin, isAdmin } from "@/game/air/admin";
import { unlockStatus } from "@/game/air/progress";
import { buyHeli, buyTier, repairHeli } from "@/game/air/economy";
import { airSave } from "@/game/air/tiers";

export function airHooks(game) {
  return {
    // spawn('heli') needs the helicopter bought (or admin); spawn('jet') does nothing unless admin.
    // Admin extras: spawn('heli', { tier: 0-3 }) flies a test helicopter at that tier on every upgrade.
    spawn(kind = "heli", o = {}) { const r = game.air.spawn(kind, o); return r.ok ? game.air.state() : r; },
    state() { return game.air.state(); },
    exit() { return game.air.exit(true); },
    // Hold flight controls for t seconds: hold({ fwd: 1, right: 0, turn: 0, up: true, down: false }, 2).
    hold(ctl, t) { return game.air.hold(ctl, t); },
    // Garage unlock without the UI: status() lists the requirements, buy() buys, tier("armour") buys the next tier.
    status() { return { ...unlockStatus(game.save), tiers: { ...airSave(game.save).tiers } }; },
    buy() { return buyHeli(game.save); },
    tier(id) { return buyTier(game.save, id); },
    repair() { return repairHeli(game.save); },
    // Rank test: count finished jobs or a Warlord kill into the save.
    rank({ jobs, warlord } = {}) {
      const st = game.save.stats;
      if (jobs !== undefined) st.jobsDone = +jobs;
      if (warlord !== undefined) st.warlords = warlord ? 1 : 0;
      return unlockStatus(game.save);
    },
  };
}

export function adminHook(on) {
  if (on === undefined) return isAdmin();
  return setDevAdmin(!!on);
}