// game.workshop: builds the player's car from the built design (or today's garage car), fits upgrade tiers, runs the
// bikes and per-vehicle tier effects each step, counts finished jobs and contracts for unlocks, and spawns designs.
// Rules with maxTier cap every tier fitted in play (the save keeps what you bought).
import { createVehicle, placeVehicle } from "@/game/vehicles/vehicle";
import { compileDesign } from "@/game/workshop/compile";
import { fitTune, garageTune, fitModules, tuneStep } from "@/game/workshop/apply";
import { isBike, bikeStep, bikeFrame } from "@/game/workshop/bike";
import { bulwarkBossDrive } from "@/game/ai/bulwarkBoss";
import { isTank, tankTreadScroll } from "@/game/vehicles/tank";
import { ensureWorkshop } from "@/game/workshop/store";
import { countJobDone } from "@/game/workshop/progress";
import { rulesCap } from "@/game/workshop/tiers";
import { normalizeDesign } from "@/game/workshop/validate";
import { CHASSIS_PARTS } from "@/game/workshop/parts";
import { presetByName, PRESET_FOR } from "@/game/workshop/designs";
import { findBlueprint } from "@/game/workshop/blueprints";

export function capDesign(design, cap = rulesCap()) {
  const d = normalizeDesign(design);
  for (const k in d.parts) d.parts[k].tier = Math.min(d.parts[k].tier, cap);
  for (const w of d.weapons) if (w) w.tier = Math.min(w.tier, cap);
  return d;
}
const capTune = (t, cap) => {
  const out = { ...t, weaponTiers: Object.fromEntries(Object.entries(t.weaponTiers || {}).map(([k, x]) => [k, Math.min(x, cap)])) };
  for (const k of ["ramTier", "turboTier", "engineTier", "tyreTier", "traverseTier", "hullTier"]) if (out[k]) out[k] = Math.min(out[k], cap);
  return out;
};

export function createWorkshop(game) {
  const { save } = game;
  ensureWorkshop(save);

  // Finished jobs and contracts count toward the tier unlocks.
  const callout = game.callout;
  game.callout = (title, ...rest) => {
    if ((title === "JOB DONE" || title === "CONTRACT DONE") && !game.noSave) countJobDone(save);
    return callout(title, ...rest);
  };
  // Ram tiers and spiked tyres multiply car-on-car damage on top of the rules.
  const ramMul = game.ruleSys.ramMul;
  game.ruleSys.ramMul = (victim, attacker) => ramMul(victim, attacker) * (attacker && attacker.ramMul ? attacker.ramMul : 1);

  // A vehicle from a design. o: createVehicle options (team, name, plate...).
  function createDesigned(design, o = {}) {
    const c = compileDesign(capDesign(design));
    const v = createVehicle(game, c.id, { paint: c.design.paint, paint2: "#3a3734", loadout: c.loadout, armour: c.armour, hull: c.stats.hull, ...o });
    v.design = c;
    if (c.cls === "bike") { v.stats = { ...c.stats }; v.ownStats = true; }
    fitTune(game, v, c.tune);
    return v;
  }

  const ws = () => ensureWorkshop(save);
  const api = {
    // The player's car when the built design is the ride; null keeps today's garage car.
    makeCar(o) { const w = ws(); return w.ride === "design" && w.built ? createDesigned(w.built, o) : null; },
    // After makePlayer's own fuel / module set-up: tiers of the garage car, module tiers for both.
    fit(v) {
      if (!v.design) fitTune(game, v, capTune(garageTune(save, v), rulesCap()));
      else { v.fuelMax *= v.design.tune.fuelMul || 1; v.fuel = v.fuelMax; } // makePlayer reset the tank after createDesigned
      fitModules(save, v);
    },
    // Spawn clearance (half length) of the ride, or null for the garage chassis default.
    spawnHalf() { const w = ws(); return w.ride === "design" && w.built ? compileDesign(w.built).chassis.hit.half[2] : null; },
    rideIsDesign: () => ws().ride === "design" && !!ws().built,
    createDesigned,
    // spawn("dirtbike" | "chopper" | "sidecar" | blueprint name | "preset:Brawler" | design object, pose) -> vehicle or null.
    resolve(kind) {
      if (kind && typeof kind === "object") return kind;
      if (typeof kind !== "string") return null;
      if (CHASSIS_PARTS[kind] && CHASSIS_PARTS[kind].cls === "bike") return presetByName(PRESET_FOR[kind]);
      if (kind.startsWith("preset:")) return presetByName(kind.slice(7));
      const b = findBlueprint(save, kind);
      return b ? b.design : null;
    },
    spawn(kind, pose, o = {}) {
      const d = api.resolve(kind);
      if (!d) return null;
      const v = createDesigned(d, { team: o.team || "rattler", name: o.name || normalizeDesign(d).name, plate: "WS-" + (10 + game.vehicles.length) });
      placeVehicle(v, pose.x, pose.y + 1.2, pose.z, pose.heading);
      game.vehicles.push(v);
      return v;
    },
    // Each fixed step after the controls, before physics.
    control(dt) {
      for (const v of game.vehicles) {
        if (v.remote) continue;
        if (v.baseAccel !== undefined) tuneStep(game, v, dt);
        if (isBike(v)) bikeStep(game, v, dt);
        else if (v.brain?.mode === "bulwark") bulwarkBossDrive(game, v, dt);
      }
    },
    // Each render frame (after the crosshair aim).
    frame(dt) { for (const v of game.vehicles) { if (isBike(v)) bikeFrame(v, dt); else if (isTank(v)) tankTreadScroll(v, dt); } },
  };
  game.workshop = api;
  return api;
}