// Arena mode controller: builds the chosen arena (once per map, it then stays on the map), clears the open-world
// AI, drops you and the opponents at the spawn points, runs the horde, crates, breakables and checkpoints, the
// clock and the win check, and pays out at the end. leave() puts everything back to the open world.
import { findSites } from "@/game/arena/site";
import { buildShell, toWorldPoints } from "@/game/arena/shell";
import { QUARRY, buildQuarry } from "@/game/arena/maps/quarry";
import { YARD, buildYard } from "@/game/arena/maps/yard";
import { HOLLOW, buildHollow } from "@/game/arena/maps/hollow";
import { createBreakables } from "@/game/arena/breakables";
import { createCheckpoints } from "@/game/arena/checkpoints";
import { createOpponents } from "@/game/arena/opponents";
import { createHorde } from "@/game/arena/horde";
import { createStatus } from "@/game/arena/status";
import { createPowerups } from "@/game/arena/powerups";
import { createRace } from "@/game/arena/race";
import { clearAI } from "@/game/rules/population";
import { getRules, setRules } from "@/game/rules/state";
import { DEFAULT_RULES, WIN } from "@/game/rules/gameRules";
import { writeSave } from "@/game/core/save";
import { createPen } from "@/game/arena/custom/penMap";
import { DATA_MAPS } from "@/game/arena/custom/dataMaps";
import { isWorldMap } from "@/game/maps/catalog";
import { createTrackRace } from "@/game/maps/race/trackRace";
import { spawnBulwarkBoss } from "@/game/ai/bulwarkBoss";

const MAPS = { quarry: [QUARRY, buildQuarry], yard: [YARD, buildYard], hollow: [HOLLOW, buildHollow] };

export function createArena(game) {
  const built = {};
  const A = {
    active: false, over: false, status: createStatus(game), breakables: createBreakables(game), checkpoints: createCheckpoints(game),
    opponents: createOpponents(game), horde: createHorde(game), race: createRace(game), powerups: null, rules: null, map: null, timeLeft: 0, stats: null,
  };
  game.horde = A.horde;
  game.arena = A;
  A.ringRace = A.race; A.trackRace = createTrackRace(game); // a race world races on its track (maps/race/trackRace.js)
  A.powerups = createPowerups(game);

  const pen = createPen(game);
  function build(id) {
    if (isWorldMap(id)) return game.maps.load(id); // round 15: a world of its own (maps/loader.js)
    game.maps.unload();
    if (DATA_MAPS[id]) return pen.load(DATA_MAPS[id]()); // your own map or a race track: laid out afresh every match
    if (built[id]) return built[id];
    const site = findSites(game.world)[id], [def, fn] = MAPS[id];
    const ctx = buildShell(game, site, def.look(game.M));
    const L = fn(ctx);
    ctx.kit.finalize();
    const W = (list, y) => toWorldPoints(ctx, list, y);
    return (built[id] = { ctx, name: def.name, cps: W(L.checkpoints), power: W(L.power), spawns: W(L.spawns), horde: W(L.horde), props: W(L.props) });
  }
  function pose(i) {
    const g = A.map.spawns[i % A.map.spawns.length];
    if (g.heading !== undefined && A.rules.win === "race") return g; // a race world's start grid
    const m = A.map, s = m.spawns[i % m.spawns.length], racing = A.rules.win === "race", c = racing ? m.cps[0] : m.ctx.site; // a race grid faces the first ring
    const dx = s.faceX && !racing ? Math.sign(c.x - s.x) || 1 : c.x - s.x, dz = s.faceX && !racing ? 0 : c.z - s.z;
    return { x: s.x, y: s.y, z: s.z, heading: Math.atan2(-dx, -dz) };
  }
  // The player's arena car: the starting car, else the garage car if allowed, else the first allowed one.
  const carFor = (r) => r.startCar || (r.cars.includes(game.save.garage.chassis) ? game.save.garage.chassis : r.cars[0]);
  const spawnPose = game.spawnPose, respawn = game.respawnPlayer;
  // In a race you come back at the last ring you passed; otherwise at a random spawn point.
  game.spawnPose = () => (!A.active ? spawnPose() : A.race.on() ? A.race.back(-1) || pose(0) : pose(Math.floor(Math.random() * A.map.spawns.length)));
  game.respawnPlayer = (p) => {
    if (!A.active) return respawn(p);
    const g = game.save.garage, keep = g.chassis;
    g.chassis = carFor(A.rules);
    try { return respawn(p || game.spawnPose()); } finally { g.chassis = keep; }
  };
  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => { onWreck(v, attacker); if (A.active && v.arena && attacker === game.player) A.stats.wrecks++; };
  A.onSmash = () => { if (A.active) A.stats.smashed++; };
  A.onHordeKill = () => { if (A.active) A.stats.kills++; };

  const wins = () => { const w = A.rules.win; return { race: w === "race", cp: w === "checkpoints" || w === "any", wreck: (w === "wreck" || w === "any") && A.rules.aiCount > 0, horde: (w === "horde" || w === "any") && A.horde.active() }; };

  // Lobby matches: slot = this player's spawn point; the local AI starts after every human's spawn point.
  A.start = (rules = getRules(), { slot = 0, humans = 1 } = {}) => {
    A.stop();
    A.rules = rules; A.map = build(rules.map);
    const onTrack = rules.win === "race" && !!A.map.track; // a race world: laps of its track, with time for all of them
    A.race = onTrack ? A.trackRace : A.ringRace;
    A.active = true; A.over = false; A.timeLeft = onTrack ? rules.laps * (A.map.layout.lapTime || 150) * 2.5 : rules.timeLimit;
    A.stats = { wrecks: 0, kills: 0, smashed: 0, cps: 0, t0: game.time };
    clearAI(game);
    game.respawnPlayer(pose(slot));
    A.status.clear(game.player);
    if (game.traps) { game.traps.clearDropped(); game.player.flat = null; game.traps.refill(game.player); }
    const aiPose = humans > 1 ? (i) => pose(i + humans - 1) : pose, racing = rules.win === "race";
    if (racing) A.race.start(A.map.cps, rules.laps, A.checkpoints, A.opponents); else A.race.stop();
    A.opponents.start(rules.aiCount, { pose: aiPose, skill: rules.aiSkill, site: A.map.ctx.site, R: A.map.ctx.R, floorY: A.map.ctx.floorY, race: racing ? A.race : null });
    A.horde.start(onTrack && rules.horde === "off" && A.map.layout.zombies ? "zombies" : rules.horde, rules.hordeDensity, A.map.horde);
    if (rules.horde !== "off" && !onTrack) spawnBulwarkBoss(game, aiPose(rules.aiCount + 1), { tag: "HORDE" });
    A.powerups.start(rules.powerups ? A.map.power : []);
    A.breakables.spawn(A.map.props);
    if (wins().cp || (racing && !onTrack)) A.checkpoints.set(A.map.cps); else A.checkpoints.clear();
    game.callout(A.map.name.toUpperCase(), WIN[rules.win], "#f2c230");
  };

  function finish(won, reason, title) {
    A.over = true;
    const p = game.player, bonus = won ? 250 : 50, payout = p.scrap + bonus;
    p.scrap = 0;
    if (!game.noSave) { game.save.banked += payout; writeSave(game.save); }
    game.callout(won ? "YOU WIN" : title || "TIME'S UP", reason, won ? "#7fe0a0" : "#ff4a2a");
    const S = A.stats, place = A.race.on() ? `${A.race.place()}/${A.race.field()}` : null;
    setTimeout(() => game.emit({ type: "arenaResults", data: {
      won, reason, title, map: A.map.name, rules: A.rules.name, payout, time: Math.round(game.time - S.t0),
      tally: [...(place ? [["Race place", place]] : []), ["Cars wrecked", S.wrecks], ["Horde killed", S.kills], ["Checkpoints", `${A.checkpoints.next}/${A.checkpoints.total}`], ["Props smashed", S.smashed], ["Win bonus", `+${bonus}`]],
    } }), 1800);
  }

  // Controller layer (after the drivers, before physics): opponents drive, power-up effects (freeze) apply.
  A.control = (dt) => {
    if (!A.active || A.over) return;
    const w = A.rules.win;
    A.opponents.step(dt, w === "checkpoints" || w === "horde" || w === "race");
    A.status.step(dt);
  };
  A.step = (dt) => {
    if (!A.active) return;
    A.breakables.step(dt);
    A.horde.step(dt);
    if (A.over) return;
    A.powerups.step(dt);
    if (A.checkpoints.step(game.player)) { game.audio.pickup(); game.emit({ type: "minor", text: `CHECKPOINT ${A.checkpoints.next}/${A.checkpoints.total}` }); }
    A.timeLeft -= dt;
    const W = wins();
    if (W.race) { const end = A.race.step(); if (end) return finish(end.won, end.reason, end.title); }
    if (W.cp && A.checkpoints.next >= A.checkpoints.total) return finish(true, "every checkpoint passed");
    if (W.wreck && A.opponents.alive() === 0) return finish(true, "every opponent wrecked");
    if (W.horde && A.horde.cleared()) return finish(true, "the horde is cleared");
    if (A.timeLeft <= 0) finish(false, "the clock ran out");
  };
  A.frame = (dt) => { if (!A.active) return; A.checkpoints.frame(dt); A.horde.frame(dt); A.powerups.frame(dt); };
  A.blast = (pos, radius, attacker) => { if (!A.active) return; A.breakables.blast(pos, radius, attacker); A.horde.blast(pos, radius, attacker); };

  // Clears the match (cars, horde, crates, rings). The arena walls stay.
  A.stop = () => {
    if (!A.active) return;
    A.active = false;
    clearAI(game, (v) => v.arena);
    A.ringRace.stop(); A.trackRace.stop(); A.opponents.clear(); A.horde.clear(); A.powerups.clear(); A.breakables.clear(); A.checkpoints.clear();
    if (game.player) A.status.clear(game.player);
  };
  // Back to the open world: Classic rules, the car where you left free roam (else the town gate), the AI back.
  A.leave = () => {
    A.stop();
    setRules(DEFAULT_RULES);
    game.respawnPlayer(game.maps.unload() || undefined);
    if (game.ruleSys) game.ruleSys.syncPopulation();
  };
  A.hud = () => {
    if (!A.active) return null;
    const W = wins(), p = game.player;
    const goals = [];
    if (W.race && !A.map.track) goals.push(["Lap", A.race.lapText()], ["Place", `${A.race.place()}/${A.race.field()}`], ["Ring", `${A.checkpoints.next}/${A.checkpoints.total}`]);
    if (W.cp) goals.push(["Checkpoints", `${A.checkpoints.next}/${A.checkpoints.total}`]);
    if (W.wreck) goals.push(["Opponents left", `${A.opponents.alive()}/${A.opponents.total()}`]);
    if (W.horde) goals.push([A.rules.horde === "aliens" ? "Aliens left" : "Zombies left", A.horde.remaining()]);
    const fx = [];
    if (p.armourT > 0) fx.push(`ARMOUR ${Math.ceil(p.armourT)}s`);
    if (p.megaRamT > 0) fx.push(`MEGA-RAM ${Math.ceil(p.megaRamT)}s`);
    if (p.spikesT > 0) fx.push(`SPIKES ${Math.ceil(p.spikesT)}s`);
    if (p.tripleShots > 0) fx.push(`TRIPLE ROCKETS ×${p.tripleShots}`);
    if (p.freezeShots > 0) fx.push(`FREEZE SHOT ×${p.freezeShots}`);
    if (p.frozenT > 0) fx.push("FROZEN");
    return { map: A.map.name, win: WIN[A.rules.win], time: Math.max(0, Math.ceil(A.timeLeft)), goals, fx, over: A.over };
  };
  return A;
}