// Structure materials: every built piece is wood, sheet metal, concrete or steel, each in Tier I, II and III.
// hp / mass / cost are per cubic metre of piece volume (pieces.js scales them by size).
// resist: damage multiplier per hit kind. MG fire barely chips concrete and steel; rockets, mines, rams and blasts break them.

export const TIERS = [
  { id: 1, name: "I", hp: 1, cost: 1, look: 0 },
  { id: 2, name: "II", hp: 1.6, cost: 1.9, look: 1 },
  { id: 3, name: "III", hp: 2.4, cost: 3.2, look: 2 },
];

export const MATERIALS = {
  wood: {
    id: "wood", name: "Wood", hp: 34, mass: 60, cost: 1.2,
    color: 0x8a6239, color2: 0x5e3f22, rough: 0.9, metal: 0,
    resist: { mg: 0.55, rocket: 1.4, mine: 1.3, ram: 1.3, blast: 1.4 },
    debris: "splinter",
  },
  sheet: {
    id: "sheet", name: "Sheet metal", hp: 46, mass: 90, cost: 2,
    color: 0x8f8a7c, color2: 0x6b4a2e, rough: 0.55, metal: 0.7,
    resist: { mg: 0.3, rocket: 1.1, mine: 1.1, ram: 1, blast: 1.1 },
    debris: "panel",
  },
  concrete: {
    id: "concrete", name: "Concrete", hp: 90, mass: 220, cost: 3,
    color: 0xa8a092, color2: 0x7d766a, rough: 0.95, metal: 0,
    resist: { mg: 0.04, rocket: 1, mine: 1, ram: 0.7, blast: 1 },
    debris: "chunk",
  },
  steel: {
    id: "steel", name: "Steel", hp: 120, mass: 300, cost: 5,
    color: 0x5d6168, color2: 0x3b3e43, rough: 0.4, metal: 0.9,
    resist: { mg: 0.025, rocket: 0.85, mine: 0.9, ram: 0.55, blast: 0.85 },
    debris: "plate",
  },
};

export const MATERIAL_IDS = Object.keys(MATERIALS);
export const HIT_KINDS = ["mg", "rocket", "mine", "ram", "blast"];

export const tierOf = (t) => TIERS[Math.max(0, Math.min(2, (t | 0) - 1))];
export const materialOf = (id) => MATERIALS[id] || MATERIALS.wood;

// Stats of one material at one tier for a given volume (m³).
export function matStats(matId, tier, volume) {
  const m = materialOf(matId), t = tierOf(tier), v = Math.max(0.2, volume);
  return {
    hp: Math.round(m.hp * t.hp * v),
    mass: Math.round(m.mass * v),
    cost: Math.max(1, Math.round(m.cost * t.cost * v)),
  };
}

// Damage after material resistance; higher tiers also shrug off a little more chip damage.
export function resisted(matId, tier, kind, amount) {
  const m = materialOf(matId), r = m.resist[kind] ?? 1;
  const tierChip = kind === "mg" ? 1 / tierOf(tier).hp : 1;
  return amount * r * tierChip;
}