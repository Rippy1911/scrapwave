// The Scuttler: the ready-made four-legged walker (round 12). A medium truck with a Transform Core and a reactor in
// the bed; two legs fold along each flank (front pair ahead of the cab line, rear pair behind). Stood up: four legs
// (hip motor, knee hinge) stepping in diagonal pairs, a rocket rack on top, twin MGs. No arms, no fist.
import { presetByName, copyDesign } from "@/game/workshop/designs";
import { normalizeDesign } from "@/game/workshop/validate";

const Z = [0, 0, 0], V = [90, 0, 0];

// One left leg: [id offset, type, drive z, walker y, extra]. Hip at walker (x, 0, wz); the foot ends 2.25 m down.
const LEG = [
  [0, "motor", 0, 0, { role: "hip", tier: 2 }],
  [2, "beam", 0.45, -0.5, { limb: 0, rot: V }],
  [4, "hinge", 0.9, -1.0, { role: "knee", limb: 0, tier: 2 }],
  [6, "beam", 1.35, -1.5, { limb: 4, rot: V }],
  [8, "block", 1.8, -2.0, { limb: 4 }],
];
// [first id, drive z of the hip (legs fold toward the middle), walker z of the hip]
const LEGS = [[3, 2.0, 1.0], [31, -2.1, -1.0]];

function freeParts() {
  const out = [
    { id: 1, t: "core", tier: 1, p: [0, 0.7, 0.4], r: Z },
    { id: 2, t: "reactor", tier: 2, p: [0, 0.7, 1.4], r: Z },
    { id: 21, t: "heavyMount", tier: 1, p: [0, 1.3, 1.6], r: Z, w: { p: [0, 5.0, 0.3], r: Z }, wpn: { id: "rocketRack", tier: 1 } },
  ];
  for (const [base, dz, wz] of LEGS) {
    const dir = dz > 0 ? -1 : 1; // rear legs fold forward along the flank, front legs fold back
    for (const [o, t, along, wy, x] of LEG) {
      const id = base + o, rot = x.rot || Z;
      const a = { id, t, tier: x.tier || 1, p: [-1.2, 0.55, dz + dir * along], r: Z, w: { p: [-1.25, wy, wz], r: rot }, mir: id + 1 };
      if (x.role) a.role = x.role;
      if (x.limb !== undefined) a.limb = base + x.limb;
      const b = { ...copyDesign(a), id: id + 1, mir: id, p: [1.2, a.p[1], a.p[2]], w: { p: [1.25, wy, wz], r: rot } };
      if (a.limb) b.limb = a.limb + 1;
      out.push(a, b);
    }
  }
  return out;
}

export function scuttlerDesign() {
  const d = copyDesign(presetByName("Brawler"));
  d.name = "Scuttler"; d.paint = "#5e6b3a";
  Object.assign(d.parts, { chassis: { id: "medium", tier: 2 }, cab: { id: "closed", tier: 2 }, engine: { id: "medium", tier: 2 }, tyres: { id: "offroad", tier: 1 }, ram: { id: "none", tier: 1 } });
  d.weapons = [{ id: "mg", tier: 1 }, { id: "mg", tier: 1 }, null, null];
  d.free = {
    parts: freeParts(),
    poses: [
      { name: "Crouch", key: 1, values: { 7: -0.6, 8: -0.6, 35: -0.6, 36: -0.6 } },
      { name: "Rear up", key: 2, values: { 31: -0.5, 32: -0.5, 3: 0.3, 4: 0.3 } },
    ],
    next: 50,
  };
  return normalizeDesign(d);
}