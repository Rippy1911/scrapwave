// The Wreckframe: the ready-made heavy walker. A heavy armoured truck with a Transform Core and a reactor in the
// bed; legs fold along its flanks, arms lie on the roof. Stood up: two legs (hip motor, knee hinge), an arm cannon
// on the left arm, a ram fist on the right, a shoulder rocket rack on top, back thrusters for hops.
import { presetByName, copyDesign } from "@/game/workshop/designs";
import { normalizeDesign } from "@/game/workshop/validate";

const Z = [0, 0, 0], V = [90, 0, 0];
// [id, type, drive pos, walker placement or null, extra]
const L = [
  [3, "motor", [-1.35, 0.55, 2.3], [[-0.95, 0, 0], Z], { role: "hip", tier: 2 }],
  [5, "beam", [-1.35, 0.55, 1.55], [[-0.95, -0.6, 0], V], { limb: 3, tier: 2 }],
  [7, "hinge", [-1.35, 0.55, 0.85], [[-0.95, -1.25, 0], Z], { role: "knee", limb: 3, tier: 2 }],
  [9, "beam", [-1.35, 0.55, 0.15], [[-0.95, -1.9, 0], V], { limb: 7, tier: 2 }],
  [11, "block", [-1.35, 0.55, -0.55], [[-0.95, -2.6, -0.15], Z], { limb: 7, tier: 2 }],
  [13, "hinge", [-0.75, 1.3, -0.4], [[-1.75, 4.9, 0], Z], { role: "shoulder" }],
  [15, "beam", [-0.75, 1.3, 0.3], [[-1.75, 4.3, 0], V], { limb: 13 }],
  [17, "piston", [-0.75, 1.3, 1.0], [[-1.75, 3.6, -0.2], Z], { role: "elbow", limb: 13 }],
  [19, "heavyMount", [-0.75, 1.42, 1.6], [[-1.75, 3.4, -0.75], Z], { limb: 17, wpn: { id: "armCannon", tier: 1 } }],
  [23, "thruster", [-0.6, 0.9, 2.75], null, {}],
];
// The right side: mirrored twins (id + 1), with the ram fist on the right arm.
const R = { 17: { role: "fist" }, 19: { wpn: { id: "ramFist", tier: 1 } } };

function freeParts() {
  const out = [
    { id: 1, t: "core", tier: 1, p: [0, 0.7, 0.9], r: Z },
    { id: 2, t: "reactor", tier: 2, p: [0, 0.7, 1.9], r: Z },
    { id: 21, t: "heavyMount", tier: 1, p: [0, 1.4, 2.35], r: Z, w: { p: [0, 5.85, 0.3], r: Z }, wpn: { id: "rocketRack", tier: 1 } },
  ];
  for (const [id, t, p, w, x] of L) {
    const a = { id, t, tier: x.tier || 1, p, r: Z, mir: id + 1, ...x };
    if (w) a.w = { p: w[0], r: w[1] };
    const b = { ...copyDesign(a), id: id + 1, mir: id, p: [-p[0], p[1], p[2]], ...(R[id] || {}) };
    if (w) b.w = { p: [-w[0][0], w[0][1], w[0][2]], r: w[1] };
    if (a.limb) b.limb = a.limb + 1;
    out.push(a, b);
  }
  return out;
}

export function wreckframeDesign() {
  const d = copyDesign(presetByName("Brawler"));
  d.name = "Wreckframe"; d.paint = "#8a7a52";
  Object.assign(d.parts, { chassis: { id: "heavy", tier: 2 }, cab: { id: "armoured", tier: 2 }, engine: { id: "large", tier: 2 }, tyres: { id: "offroad", tier: 1 } });
  d.weapons = [{ id: "mg", tier: 2 }, { id: "mg", tier: 2 }, null, null, null];
  d.free = {
    parts: freeParts(),
    poses: [
      { name: "Guard", key: 1, values: { 13: 0.9, 14: 0.9, 17: 0.4 } },
      { name: "Brace", key: 2, values: { 3: 0.35, 4: 0.35, 7: -0.7, 8: -0.7 } },
    ],
    next: 30,
  };
  return normalizeDesign(d);
}