// A lobby ride: { kind: "free" | "garage", ch: chassis, tier }. Free rides are stock cars (every upgrade held at
// tier I); the garage ride is your own car with its upgrades capped at the rules' maxTier. The rules' allowed cars
// (and a fixed starting car) decide which chassis may be picked. The picker and the host both use checkRide().
import { PLAYER_CARS } from "@/game/rules/gameRules";
import { tiersOf } from "@/game/workshop/store";

const clampT = (t) => Math.max(1, Math.min(3, Math.round(+t || 1)));

// Highest upgrade tier fitted on the garage car (weapons, modules, ram, engine, tyres, turbo, tank).
export function garageTier(save) {
  let m = 1;
  const see = (x) => { if (typeof x === "number") m = Math.max(m, x); else if (x && typeof x === "object") Object.values(x).forEach(see); };
  see(tiersOf(save));
  return clampT(m);
}

export const freeRide = (ch) => ({ kind: "free", ch, tier: 1 });
export function garageRide(save, rules) {
  const own = garageTier(save);
  return { kind: "garage", ch: save.garage.chassis, tier: Math.min(own, clampT(rules.maxTier)), own };
}

function chassisProblem(rules, ch) {
  if (!PLAYER_CARS[ch]) return "Not a lobby car";
  if (rules.startCar && ch !== rules.startCar) return `These rules start everyone in the ${PLAYER_CARS[rules.startCar]}`;
  if (!rules.cars.includes(ch)) return "Not allowed in these rules";
  return null;
}

// null = the ride is fine under these rules, else the reason it is not.
export function checkRide(rules, ride) {
  if (!ride) return null; // no pick yet: the default ride is used
  if (ride.kind !== "free" && ride.kind !== "garage") return "Unknown ride";
  const bad = chassisProblem(rules, ride.ch);
  if (bad) return bad;
  if (ride.kind === "free" && ride.tier !== 1) return "Free rides are tier I";
  if (clampT(ride.tier) > clampT(rules.maxTier)) return `These rules cap upgrades at tier ${clampT(rules.maxTier)}`;
  return null;
}

export const defaultRide = (rules) => freeRide(rules.startCar || rules.cars[0]);
export const rideCap = (ride, rules) => (ride && ride.kind === "garage" ? clampT(rules.maxTier) : 1);
export const rideName = (ride) => (ride ? `${PLAYER_CARS[ride.ch] || ride.ch}${ride.kind === "garage" ? " (garage)" : ""}` : "Choosing...");

// Every ride the picker offers, each with `why` (null = can be picked) and `note` (shown, not blocking).
export function rideOptions(save, rules) {
  const list = Object.keys(PLAYER_CARS).map((ch) => ({ ...freeRide(ch), name: PLAYER_CARS[ch], why: chassisProblem(rules, ch), note: "Stock · tier I" }));
  const g = garageRide(save, rules);
  const capped = g.own > g.tier ? ` · capped from ${g.own}` : "";
  list.unshift({ ...g, name: `${PLAYER_CARS[g.ch] || g.ch} (garage)`, why: chassisProblem(rules, g.ch), note: `Your upgrades · tier ${g.tier}${capped}` });
  return list;
}