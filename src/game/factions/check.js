// window.scrapwake.factions.check(): a scripted pass over the round 11 rules in the live game. Reputation is put
// back afterwards. Returns { ok, results: [{ name, ok, detail }] }. Also runs from ?factioncheck=1 (factions/hooks.js).
import { menuFreezes } from "@/game/ui/menuPause";
import { readFoot, packFoot } from "@/game/onfoot/footNet";

export function runFactionCheck(game) {
  const F = game.factions, rep = F.rep, out = [];
  const keep = { ...game.save.rep }, snap = JSON.stringify(game.save); // wrecks in step 1 touch stats and scrap too
  const ok = (name, pass, detail) => out.push({ name, ok: !!pass, detail });
  const flush = () => rep.step(1);
  const fake = (team, faction) => ({ team, faction, alive: true, lastHitBy: null, lastCombat: -99, pos: game.player.pos });

  // 1. Wrecking raiders: militias and Drifters up, raiders down.
  const before = { ...game.save.rep }, made = [], ap = game.autopilot;
  game.autopilot = false; // autopilot wrecks never move reputation (repEvents.js)
  for (let i = 0; i < 3; i++) {
    const p = game.player.pos, r = game.ai.makeRattler({ x: p.x + 400 + i * 12, y: game.world.groundAt(p.x + 400, p.z, 999), z: p.z + 300, heading: 0 }, null);
    made.push(r);
    r.alive = false; r.wreckTime = 0.1;
    game.onWreck(r, game.player);
  }
  flush();
  game.autopilot = ap;
  const s = game.save.rep;
  ok("wreck raiders: militia up, raiders down", s.well > before.well && s.gasket > before.gasket && s.raiders < before.raiders,
    `well ${before.well}→${s.well}, gasket ${before.gasket}→${s.gasket}, raiders ${before.raiders}→${s.raiders}`);

  // 2. Prices at Allied and Wary (Gasket sells machine parts, base 60).
  const parts = () => F.trader.view("trader-out-scrapN").goods.find((g) => g.id === "parts").buy;
  rep.set("gasket", 100); const allied = parts();
  rep.set("gasket", -30); const wary = parts();
  rep.set("gasket", -80); const hostileTrade = F.trader.view("trader-out-scrapN").canTrade;
  ok("prices: Allied cheaper, Wary dearer, Hostile no trade", allied < 60 && wary > 60 && !hostileTrade, `allied ${allied}, wary ${wary}, hostile trades: ${hostileTrade}`);

  // 3. A Friendly-only job appears on the board.
  rep.set("well", 0); const lockedAtNeutral = F.trader.view("jobs-town").board.find((j) => j.kind === "bounty").locked;
  rep.set("well", 30); const lockedAtFriendly = F.trader.view("jobs-town").board.find((j) => j.kind === "bounty").locked;
  ok("Friendly-only job (militia bounty)", lockedAtNeutral && !lockedAtFriendly, `neutral locked ${lockedAtNeutral}, friendly locked ${lockedAtFriendly}`);

  // 4. A Hostile militia attacks on sight; a Neutral one does not; Friendly raiders leave you alone.
  const guard = fake("militia", "well"), raider = fake("rattler");
  for (const k of Object.keys(F.rel.provokedUntil)) delete F.rel.provokedUntil[k]; // step 1 wrecked raiders: that provokes them
  rep.set("well", 0); const neutralAttack = F.willAttack(guard, game.player);
  rep.set("well", -80); const hostileAttack = F.willAttack(guard, game.player);
  rep.set("raiders", 40); const friendlyRaider = F.willAttack(raider, game.player);
  ok("Hostile militia attacks, Friendly raiders hold", hostileAttack && !neutralAttack && !friendlyRaider, `neutral ${neutralAttack}, hostile ${hostileAttack}, friendly raider ${friendlyRaider}`);

  // 5. AI factions at war: militia and raiders fight; militia and Drifters keep the peace.
  const war = F.willAttack(guard, raider) && F.willAttack(raider, guard), peace = !F.willAttack(guard, fake("drifter"));
  ok("AI factions fight at a border", war && peace, `militia↔raiders ${war}, militia↔drifters peace ${peace}`);

  // 6. Online menus never freeze the world; single player still pauses.
  const online = ["garage", "paused", "trader", "map", "spawn"].every((p) => !menuFreezes(p, true));
  const solo = ["garage", "paused", "trader", "map"].every((p) => menuFreezes(p, false));
  ok("online menus keep the world running", online && solo, `online free ${online}, solo pauses ${solo}`);

  // 7. On-foot state round trip through the car state (no second client needed).
  const g2 = { onfoot: { active: () => true, walker: { pos: { x: 15, z: -7 }, heading: 1.2, speed: 3, running: true, grounded: true } }, player: { pos: { x: 10, z: -10 } } };
  const st = packFoot({ flags: 1, steer: 0, thr: 0, aimYaw: 0, aimPitch: 0 }, g2), back = readFoot(st, { x: 10, y: 0, z: -10 }, game.world);
  ok("on-foot pose rides in the car state", back && Math.abs(back.x - 15) < 0.01 && Math.abs(back.z + 7) < 0.01 && back.run, back ? `walker at ${back.x}, ${back.z}` : "no pose");

  for (const [id, v] of Object.entries(keep)) game.save.rep[id] = v;
  rep.step(1);
  Object.assign(game.save, JSON.parse(snap));
  return { ok: out.every((r) => r.ok), results: out };
}