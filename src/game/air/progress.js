// Rank for the helicopter unlock. The save already counts wrecks and contracts per day, not lifetime jobs or the
// Warlord, so this listens to the game's own events and counts them into save.stats (kept with the save).
import { writeSave } from "@/game/core/save";
import { UNLOCK, airSave } from "@/game/air/tiers";

export function trackProgress(game) {
  const st = game.save.stats;
  const keep = () => { if (!game.noSave) writeSave(game.save); };
  // Jobs and contracts both announce themselves with these callouts (jobs.js, contracts.js).
  const callout = game.callout;
  game.callout = (text, sub, color) => {
    if ((text === "JOB DONE" || text === "CONTRACT DONE") && !game.noSave && !game.demo?.running) { st.jobsDone = (st.jobsDone || 0) + 1; keep(); }
    return callout(text, sub, color);
  };
  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => {
    onWreck(v, attacker);
    if (v.team === "warlord" && attacker === game.player && !game.noSave) { st.warlords = (st.warlords || 0) + 1; keep(); }
  };
}

// What the garage shows: each requirement and whether it is met.
export function unlockStatus(save) {
  const st = save.stats, a = airSave(save);
  const jobs = st.jobsDone || 0, story = (st.warlords || 0) > 0;
  const rank = story || jobs >= UNLOCK.jobs;
  return {
    owned: a.owned, rank, story, jobs, jobsNeed: UNLOCK.jobs,
    price: UNLOCK.price, banked: save.banked, canBuy: !a.owned && rank && save.banked >= UNLOCK.price,
  };
}