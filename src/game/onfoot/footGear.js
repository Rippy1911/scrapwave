// On-foot gear: what a walker carries and the numbers behind it. Two weapon slots (a long gun and a sidearm) plus
// grenades and C4. Every weapon comes in Tier I, II and III; a value written as [a, b, c] is one number per tier.
export const FOOT = {
  exitKmh: 15, // E outside a safe zone works below this, with wheels on the ground
  killKmh: 12, // a car that touches a walker at or above this kills outright
  knockKmh: 1.5, // slower than killKmh, faster than this: knocked down
  knockTime: 1.5, // seconds on the ground
  health: 100,
  fallSafe: 11.5, // m/s on landing that costs nothing (a drop of about 3 m)
  fallKill: 22, // m/s on landing that kills (a drop of about 12 m)
  regenDelay: 8, regen: 3, // health per second, after this long without harm
  respawnTime: 3, // seconds lying dead before the respawn
  lootLife: 300, // seconds a dropped kit stays
  gravity: 9.8, // bullet drop
  hordeBite: 3, // crowd damage to a walker, times its damage to a hull
};

export const TIER_NAMES = ["Scrap", "Welded", "War-forged"];
export const SLOTS = ["long", "side", "grenade", "c4"]; // keys 1, 2, 3, 4

export const GEAR = {
  // Sniper rifle: 5 rounds, bullet drop and travel time, a scope with two zoom steps (fov per step).
  sniper: {
    name: "Farcall rifle", slot: "long", kind: "bullet", mag: 5, spare: [10, 15, 20], reload: 2.6, rate: 1.1,
    speed: [420, 520, 640], body: [50, 60, 70], head: 200, car: [8, 12, 16], driver: [50, 70, 100], stun: [3, 4, 5],
    range: 900, hip: 0.035, zoom: [[20, 9], [18, 7.5], [16, 6]], sound: "autocannon", net: "mg",
  },
  rpg: {
    name: "Stovepipe launcher", slot: "long", kind: "rocket", mag: 1, spare: [3, 4, 5], reload: 3.2, rate: 0.6,
    speed: [55, 65, 75], dmg: [90, 120, 150], splash: [5, 6, 7], range: 400, hip: 0.02, sound: "rockets",
  },
  sidearm: {
    name: "Rivet pistol", slot: "side", kind: "bullet", mag: [8, 10, 12], spare: [32, 40, 48], reload: 1.4, rate: 0.28,
    speed: 300, body: [25, 30, 34], head: [50, 60, 68], car: [3, 4, 5], driver: [15, 20, 25], stun: [1, 1, 1.5],
    range: 140, hip: 0.02, sound: "scatter", net: "mg",
  },
  grenade: { name: "Pipe grenade", slot: "grenade", kind: "grenade", max: 3, fuse: 2.5, throw: 17, dmg: [70, 95, 120], splash: [6, 7, 8] },
  c4: { name: "C4 charge", slot: "c4", kind: "c4", max: 2, throw: 6, dmg: [140, 190, 240], splash: [7, 8, 9] },
};

export const validTier = (t) => Math.min(3, Math.max(1, Math.round(+t) || 1));

// The numbers of one item at one tier: every [a, b, c] becomes its tier's value (zoom keeps its two steps).
export function gearStats(id, tier = 1) {
  const g = GEAR[id];
  if (!g) return null;
  const i = validTier(tier) - 1, out = { id, tier: i + 1, label: `${g.name} · ${TIER_NAMES[i]}` };
  for (const k in g) out[k] = Array.isArray(g[k]) ? g[k][i] : g[k];
  return out;
}

// What a walker with empty hands gets when they climb out: Tier I, and little of it.
export const STARTER = { long: { id: "sniper", tier: 1 }, side: { id: "sidearm", tier: 1 }, grenade: { tier: 1, n: 2 }, c4: { tier: 1, n: 1 } };