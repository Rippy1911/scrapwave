// Wing parts and their aerodynamics (round 13). Pure data and maths: no three.js, no game state.
// A car carries a list of mounted wings: { id, tier, side: "left" | "right" | "roof", hp, hpMax, off }.
// The flight code (vehicles/wingFlight.js) asks wingAero() for the totals and liftAt()/dragAt() every step.
// Cars without wings never reach that code, so they fly exactly as before.

export const WING_CEILING = 220; // metres above the ground datum, same as the helicopter
export const WING_SIDES = ["left", "right", "roof"];
export const WING_TIERS = [1, 2, 3];
export const TIER_NAMES = ["", "I", "II", "III"];

// Per tier: lighter, tougher, more lift, dearer.
const TIER = {
  1: { lift: 1, hp: 1, mass: 1, cost: 1 },
  2: { lift: 1.15, hp: 1.5, mass: 0.9, cost: 2.2 },
  3: { lift: 1.3, hp: 2.2, mass: 0.8, cost: 4.5 },
};

// area: m2 of one piece. drag: profile drag factor (lower glides further). span/chord/sweep: the mesh.
// A tail fin gives no lift: it steadies the nose (stab) and tightens banked turns.
export const WINGS = {
  stub: { id: "stub", name: "Stub Wings", blurb: "Short and tough. Long jumps, fast and twitchy.", area: 1.7, drag: 0.95, mass: 28, hp: 70, cost: 120, span: 1.15, chord: 0.95, sweep: 0.1, mounts: ["left", "right", "roof"] },
  glider: { id: "glider", name: "Glider Wings", blurb: "Long and light. Glides far, breaks easily.", area: 3.5, drag: 0.62, mass: 34, hp: 45, cost: 260, span: 2.7, chord: 0.85, sweep: 0.05, mounts: ["left", "right", "roof"] },
  swept: { id: "swept", name: "Swept Wings", blurb: "Big swept wings. Real flight on turbo.", area: 4.7, drag: 0.85, mass: 62, hp: 95, cost: 480, span: 2.3, chord: 1.5, sweep: 0.55, mounts: ["left", "right", "roof"] },
  tailfin: { id: "tailfin", name: "Tail Fin", blurb: "Holds the nose steady and sharpens banked turns.", area: 0.8, drag: 0.5, mass: 14, hp: 40, cost: 90, span: 0.9, chord: 0.8, sweep: 0.5, fin: true, stab: 1, mounts: ["roof"] },
};
export const WING_IDS = Object.keys(WINGS);

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const tierOf = (t) => TIER[clamp(Math.round(+t) || 1, 1, 3)];

// One wing part at a tier: what the Workshop lists and bills.
export function wingSpec(id, tier = 1) {
  const w = WINGS[id];
  if (!w) return null;
  const t = clamp(Math.round(+tier) || 1, 1, 3), k = tierOf(t);
  return {
    id, tier: t, name: `${w.name} ${TIER_NAMES[t]}`, base: w.name, blurb: w.blurb, fin: !!w.fin, mounts: w.mounts,
    area: +(w.fin ? 0 : w.area * k.lift).toFixed(2), finArea: w.fin ? w.area : 0, drag: w.drag, stab: (w.stab || 0) * k.lift,
    mass: Math.round(w.mass * k.mass), hp: Math.round(w.hp * k.hp), cost: Math.round(w.cost * k.cost),
    span: w.span, chord: w.chord, sweep: w.sweep,
  };
}

// Every wing part at every tier (the Workshop palette).
export function wingCatalog() {
  const out = [];
  for (const id of WING_IDS) for (const t of WING_TIERS) out.push(wingSpec(id, t));
  return out;
}

// A mounted wing instance for a vehicle.
export function makeWing(id, tier = 1, side = "left") {
  const s = wingSpec(id, tier);
  if (!s) return null;
  const sd = s.mounts.includes(side) ? side : s.mounts[0];
  return { id, tier: s.tier, side: sd, hp: s.hp, hpMax: s.hp, off: false };
}

// Clean a saved or shared wing list: known ids, legal sides, one wing per side, at most one fin on the roof.
export function sanitizeWings(list) {
  const out = [], used = new Set();
  if (!Array.isArray(list)) return out;
  for (const raw of list) {
    if (!raw || !WINGS[raw.id]) continue;
    const w = makeWing(raw.id, raw.tier, raw.side);
    const key = WINGS[w.id].fin ? "fin" : w.side;
    if (used.has(key)) continue;
    used.add(key);
    out.push(w);
  }
  return out;
}

// Tuning. Lift is a fraction of gravity so it needs no knowledge of the physics units:
// 6 m2 of Tier I wing carries a reference car (load 1) at 40 m/s (144 km/h).
const LIFT_K = 1 / (6 * 40 * 40);
const LIFT_MAX = 1.7; // of gravity: enough to pull up, never a rocket
const DRAG_K = 0.00042; // m/s2 per m2 per (m/s)2 in the air
const INDUCED = 0.085; // drag that comes with lift (fraction of the lift)
const GROUND_DRAG = 0.011; // top speed lost on the ground per m2
const GROUND_MAX = 0.16;
const STALL_FRAC = 0.42; // lift fraction the wing set must reach to stay flying
const STALL_MIN = 13, STALL_MAX = 38; // m/s

// Totals for a car's wing list. load = car mass / reference mass (1 when unknown): heavy cars need more wing.
export function wingAero(wings, load = 1) {
  const a = { count: 0, fins: 0, area: 0, areaL: 0, areaR: 0, dragArea: 0, stab: 0, mass: 0, lost: 0, load: clamp(load || 1, 0.5, 3) };
  for (const w of wings || []) {
    const s = wingSpec(w.id, w.tier);
    if (!s) continue;
    if (w.off) { a.lost++; continue; }
    a.mass += s.mass;
    if (s.fin) { a.fins++; a.stab += s.stab; a.dragArea += s.finArea * s.drag; continue; }
    a.count++;
    a.area += s.area; a.dragArea += s.area * s.drag;
    if (w.side === "left") a.areaL += s.area;
    else if (w.side === "right") a.areaR += s.area;
    else { a.areaL += s.area / 2; a.areaR += s.area / 2; }
  }
  a.has = a.count > 0;
  a.liftK = (a.area * LIFT_K) / a.load; // lift fraction of gravity per (m/s)2
  a.dragK = a.dragArea * DRAG_K; // m/s2 per (m/s)2
  a.stall = a.has ? clamp(Math.sqrt(STALL_FRAC / a.liftK), STALL_MIN, STALL_MAX) : Infinity;
  // -1..1: negative rolls the car to the left. A lost left wing leaves lift on the right only, so the car rolls left.
  a.rollBias = a.has ? clamp((a.areaL - a.areaR) / a.area, -1, 1) : 0;
  a.topSpeedMul = 1 - Math.min(GROUND_MAX, a.dragArea * GROUND_DRAG);
  a.ceiling = WING_CEILING;
  return a;
}

const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

// Lift as a fraction of gravity at an airspeed (m/s) along the nose. Below the stall speed it falls away fast.
// alt: metres above the datum; lift fades out over the last 25 m under the ceiling.
export function liftAt(aero, speed, alt = 0) {
  if (!aero || !aero.has || speed <= 0) return 0;
  const raw = Math.min(LIFT_MAX, aero.liftK * speed * speed);
  const stall = smooth((speed - aero.stall * 0.7) / (aero.stall * 0.3));
  const top = 1 - smooth((alt - (WING_CEILING - 25)) / 25);
  return raw * stall * top;
}

// Drag deceleration (m/s2) in the air: profile drag plus the drag that comes with the lift being made.
export function dragAt(aero, speed, liftFrac = 0, gravity = 9.81) {
  if (!aero || !(aero.count + aero.fins)) return 0;
  return aero.dragK * speed * speed + INDUCED * liftFrac * gravity;
}

export const isStalled = (aero, speed) => !aero || !aero.has || speed < aero.stall;

// Plain numbers for the Workshop stats panel and the scrapwake.workshop.wings() hook.
export function describeWings(wings, load = 1) {
  const a = wingAero(wings, load);
  return {
    wings: a.count, fins: a.fins, lost: a.lost, area: +a.area.toFixed(2), mass: a.mass,
    lift: +(a.liftK * 1600).toFixed(3), // fraction of gravity at 144 km/h
    drag: +(a.dragK * 1600).toFixed(3), // m/s2 at 144 km/h
    stallKmh: a.has ? Math.round(a.stall * 3.6) : null,
    cruiseKmh: a.has ? Math.round(Math.sqrt(1 / a.liftK) * 3.6) : null, // speed where the wings carry the car
    topSpeedMul: +a.topSpeedMul.toFixed(3), rollBias: +a.rollBias.toFixed(2), ceiling: a.ceiling,
    canFly: a.has && a.liftK * 55 * 55 >= 1, // carries itself by 200 km/h
  };
}

// Compact text for saves, blueprints and the network: "swept2l,swept2r,tailfin1t" ("!" after a wing that is ripped off).
const SIDE_CODE = { left: "l", right: "r", roof: "t" }, CODE_SIDE = { l: "left", r: "right", t: "roof" };
export function packWings(wings) {
  return (wings || []).map((w) => `${w.id}${w.tier}${SIDE_CODE[w.side] || "t"}${w.off ? "!" : ""}`).join(",");
}
export function unpackWings(text) {
  if (!text || typeof text !== "string") return [];
  const out = [];
  for (const part of text.split(",").slice(0, 4)) {
    const m = /^([a-z]+)([123])([lrt])(!?)$/.exec(part);
    if (!m || !WINGS[m[1]]) continue;
    const w = makeWing(m[1], +m[2], CODE_SIDE[m[3]]);
    if (m[4]) { w.off = true; w.hp = 0; }
    out.push(w);
  }
  return out;
}

// Damage to one wing. Returns true when this hit rips it off.
export function hurtWing(w, dmg) {
  if (!w || w.off) return false;
  w.hp = Math.max(0, w.hp - dmg);
  if (w.hp > 0) return false;
  w.off = true;
  return true;
}

// What a wing set costs and weighs (Workshop bill).
export function wingBill(wings) {
  let cost = 0, mass = 0, hp = 0;
  for (const w of wings || []) { const s = wingSpec(w.id, w.tier); if (s) { cost += s.cost; mass += s.mass; hp += s.hp; } }
  return { cost, mass, hp };
}