// Makes the existing systems read their numbers from the active rules. Classic (all scales 1, everything on)
// leaves every number exactly as tuning.js has it.
// - Tuning: top speed per chassis, turbo strength, module build costs (free building).
// - Each step: Rapier gravity; once per vehicle (and again after a rules change): AI skill and part loss.
// - Wraps: Rattler spawns/populate and Drifter populate (AI count), build view (building on/off).
// - Multipliers for the damage routers: dmgMul (weapons, explosions), ramMul (car on car), friendly fire.
import { VEHICLES, TURBO, BASE, WORLD, AI } from "@/game/data/tuning";
import { DRIFTER_AI } from "@/game/data/drifters";
import { getRules, onRules } from "@/game/rules/state";
import { clearAI, hasOpenWorldAI } from "@/game/rules/population";
import { setFlightMode } from "@/game/vehicles/turboFlight";

const BASE_TOP = Object.fromEntries(Object.entries(VEHICLES).map(([k, v]) => [k, { top: v.topSpeed, armoured: v.armouredTop }]));
const BASE_TURBO = { ...TURBO };
const BASE_COST = Object.fromEntries(Object.entries(BASE.modules).map(([k, m]) => [k, m.cost]));
const TIER_POS = { rookie: 0, veteran: 0.5, ace: 1 };
const lerp = (a, b, t) => a + (b - a) * t;
const side = (t) => (t === "warlord" ? "rattler" : t);

// AI skill numbers at k in 0..1 (0 rookie, 0.5 veteran, 1 ace).
export function skillAt(k) {
  const S = AI.skills, a = k < 0.5 ? S.rookie : S.veteran, b = k < 0.5 ? S.veteran : S.ace, t = k < 0.5 ? k * 2 : (k - 0.5) * 2;
  const out = {};
  for (const key in a) out[key] = lerp(a[key], b[key], t);
  return out;
}

function applyTuning(r) {
  for (const id in BASE_TOP) {
    VEHICLES[id].topSpeed = BASE_TOP[id].top * r.topSpeed;
    if (BASE_TOP[id].armoured) VEHICLES[id].armouredTop = BASE_TOP[id].armoured * r.topSpeed;
  }
  Object.assign(TURBO, BASE_TURBO);
  if (r.turbo !== 1) {
    TURBO.force = 1 + (BASE_TURBO.force - 1) * r.turbo;
    TURBO.speed = 1 + (BASE_TURBO.speed - 1) * r.turbo;
    for (const k of ["push", "kick", "airThrust"]) TURBO[k] = BASE_TURBO[k] * r.turbo;
  }
  for (const k in BASE_COST) BASE.modules[k].cost = r.freeBuild && k !== "rig" ? 0 : BASE_COST[k];
  setFlightMode(r.turbo > 0 ? r.flight : "off"); // round 14: Off, Arcade or High air turbo
}

export function createRuleSystem(game) {
  let stamp = 1;
  const R = () => getRules();
  applyTuning(R());
  onRules((r) => { applyTuning(r); stamp++; });

  function perVehicle(v, r) {
    v._rules = stamp;
    if (v !== game.player && v.skill && TIER_POS[v.skillName] !== undefined && !v.arena) {
      if (!v._skill0) v._skill0 = v.skill;
      v.skill = r.aiSkill === 0.5 ? v._skill0 : skillAt(Math.max(0, Math.min(1, TIER_POS[v.skillName] + r.aiSkill - 0.5)));
      v.spreadMul = v.skill.spread / 0.03;
    }
    for (const p of v.mesh.parts) {
      if (p.kind === "body" || p.kind === "armour" || p.hp === undefined) continue;
      if (p._hp0 === undefined) p._hp0 = p.hp;
      p.hp = r.partLoss ? Math.min(p.hp, p._hp0) : 1e9;
    }
  }

  const sys = {
    rules: R,
    aiCap: () => Math.min(DRIFTER_AI.keepAlive, R().aiCount),
    fuelOn: () => R().fuel,
    friendly(victim, attacker) {
      if (R().friendlyFire || !attacker || !attacker.team || attacker === victim || victim.team === "drifter") return false;
      return side(attacker.team) === side(victim.team);
    },
    dmgMul(victim, attacker) {
      if (sys.friendly(victim, attacker)) return 0;
      return R().damage * (victim.armourT > 0 ? 0.5 : 1);
    },
    ramMul(victim, attacker) {
      if (sys.friendly(victim, attacker)) return 0;
      return R().ramDamage * (attacker && attacker.megaRamT > 0 ? 2 : 1) * (attacker && attacker.spikesT > 0 ? 1.5 : 1) * (victim.armourT > 0 ? 0.5 : 1);
    },
    step() {
      const r = R(), P = game.world.phys;
      const gy = -WORLD.gravity * r.gravity;
      if (P && P.R.gravity.y !== gy) P.R.gravity = { x: 0, y: gy, z: 0 };
      for (const v of game.vehicles) if (v._rules !== stamp && !v.remote) perVehicle(v, r);
    },
    // Start of a session: match the open-world AI to the AI count.
    syncPopulation() {
      if (R().aiCount === 0) clearAI(game);
      else if (!hasOpenWorldAI(game)) { game.ai.populate(); game.drifters.populate(); }
    },
  };

  // Wraps, in the order the systems were created (net sync already wrapped ai.spawn for host-only spawns).
  const spawn = game.ai.spawn, populate = game.ai.populate, dPopulate = game.drifters.populate, open = game.buildView.open;
  const aiOn = () => R().aiCount > 0 && !(game.arena && game.arena.active) && !(game.big && game.big.active); // the Ashmark has no AI yet
  game.ai.spawn = (...a) => (aiOn() ? spawn(...a) : null);
  game.ai.populate = (...a) => (aiOn() ? populate(...a) : null);
  game.drifters.populate = (n = DRIFTER_AI.keepAlive) => (aiOn() ? dPopulate(Math.min(n, sys.aiCap())) : null);
  game.buildView.open = () => {
    if (R().building) return open();
    game.emit({ type: "minor", text: "BUILDING IS OFF IN THESE RULES" });
    return true;
  };
  return sys;
}