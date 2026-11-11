// Fame from gameplay hooks (not telemetry — avoids double counting).

import { jobDef } from "@/game/factions/jobCatalog";
import { addFame, FAME_GAIN } from "@/game/fame/fame";
import { setFameEconomyHook } from "@/game/workshop/economy";

export function attachFameEvents(game) {
  const playerAct = (attacker) => attacker === game.player && !game.autopilot && !game.demo?.running;

  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => {
    onWreck(v, attacker);
    if (!playerAct(attacker) || v === game.player) return;
    let pts = FAME_GAIN.wreck;
    if (attacker && !attacker.grounded) pts = FAME_GAIN.wreckAir;
    if (v.team === "warlord") pts = FAME_GAIN.wreckWarlord;
    addFame(game, "carnage", pts);
    if (attacker && !attacker.grounded) addFame(game, "sky", FAME_GAIN.skyKill);
  };

  // rules.js sets onAirLanded after attachRules; fame installs later — bindAirLanded() in createFame.

  const onBank = game.onBank;
  game.onBank = (amount) => {
    if (onBank) onBank(amount);
    if (game.autopilot || game.demo?.running) return;
    const chunks = Math.floor(amount / 200);
    if (chunks > 0) addFame(game, "salvage", chunks * FAME_GAIN.bankChunk);
  };

  const emit = game.emit;
  game.emit = (e) => {
    emit(e);
    if (!e || game.demo?.running || game.autopilot) return;
    if (e.type === "results") addFame(game, "survival", FAME_GAIN.cycleEnd);
    if (e.type === "arenaResults" && e.data) {
      const d = e.data;
      if (d.rules && /race/i.test(d.rules)) {
        addFame(game, "speed", FAME_GAIN.raceFinish);
        const placeRow = d.tally?.find?.((x) => x[0] === "Race place");
        const p = placeRow ? parseInt(String(placeRow[1]), 10) : 0;
        if (p === 1) addFame(game, "speed", FAME_GAIN.racePodium1);
        else if (p === 2) addFame(game, "speed", FAME_GAIN.racePodium2);
        else if (p === 3) addFame(game, "speed", FAME_GAIN.racePodium3);
      }
      if (/horde/i.test(d.rules || "")) {
        addFame(game, "survival", FAME_GAIN.hordeNight);
        if (d.won) addFame(game, "survival", FAME_GAIN.hordeClear);
      }
    }
    if (e.type === "fameAshmark") addFame(game, "survival", FAME_GAIN.ashmarkEpoch);
  };

  if (game.factions) {
    const jobDone = game.factions.jobDone;
    game.factions.jobDone = (kind) => {
      if (jobDone) jobDone(kind);
      const def = jobDef(kind);
      if (!def || game.autopilot) return;
      addFame(game, "salvage", FAME_GAIN.jobDone);
      if (kind === "bounty" || def.title?.toLowerCase().includes("bounty")) addFame(game, "carnage", FAME_GAIN.bountyJob);
    };
  }

  setFameEconomyHook((kind) => {
    if (game.autopilot || game.demo?.running) return;
    if (kind === "upgrade") addFame(game, "salvage", FAME_GAIN.upgradeBought);
    if (kind === "build") addFame(game, "salvage", FAME_GAIN.workshopBuild);
  });

  let skyT = 0;
  return {
    step(dt) {
      if (!game.air?.active?.() || game.autopilot) return;
      skyT += dt;
      while (skyT >= 10) {
        skyT -= 10;
        addFame(game, "sky", FAME_GAIN.skyFlight10s);
      }
    },
    bindAirLanded() {
      const prev = game.onAirLanded;
      game.onAirLanded = (t) => {
        if (prev) prev(t);
        if (game.autopilot || game.demo?.running) return;
        const p = game.player;
        const flips = Math.round(Math.abs(p.flipAcc || 0) / (Math.PI * 2));
        const rolls = Math.round(Math.abs(p.rollAcc || 0) / (Math.PI * 2));
        if (t > 1.2) addFame(game, "stunts", Math.min(40, Math.round(t * FAME_GAIN.airSecond)));
        if (t > 3) addFame(game, "stunts", FAME_GAIN.bigAir);
        if (flips + rolls > 0) addFame(game, "stunts", (flips + rolls) * FAME_GAIN.flip);
      };
    },
  };
}
