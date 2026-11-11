// The chassis spec of a built car: the same format as CHASSIS in data/vehicles.js (parts, wheels, hardpoints, armour
// sockets, hit box, spheres, exhausts), so build.js, physics.js and the damage code read it unchanged.
import { PHYSICS } from "@/game/data/tuning";
import { CHASSIS_PARTS, CAB_PARTS, TYRE_PARTS, ENGINE_PARTS, mountList, sideMounts, mountSide } from "@/game/workshop/parts";
import { statMul } from "@/game/workshop/tiers";
import { cabParts, bodyParts } from "@/game/workshop/layoutParts";

const P = (id, kind, zone, hp, shape, size, pos, mat, extra = {}) => ({ id, kind, zone, hp: Math.round(hp), shape, size, pos, mat, ...extra });
const Wh = (id, x, y, z, r, w, steer, drive) => ({ id, pos: [x, y, z], r, w, steer, drive, hp: 160 });

export function layoutChassis(design) {
  const p = design.parts, F = CHASSIS_PARTS[p.chassis.id], ty = TYRE_PARTS[p.tyres.id], eng = ENGINE_PARTS[p.engine.id];
  const L = F.len, W = F.wid, hz = L / 2, deck = 0.1, fm = statMul(p.chassis.tier);
  const r = F.r * ty.r, sus = F.sus + ty.sus, bus = p.body.id === "bus";
  const hoodLen = Math.min(1.4, L * 0.26), cabLen = Math.min(2.2, Math.max(1.4, L * 0.32));
  const cabZ0 = -hz + hoodLen + 0.05, cabZ = cabZ0 + cabLen / 2;
  const bodyZ0 = bus ? cabZ0 : cabZ0 + cabLen + 0.05, bodyLen = hz - 0.08 - bodyZ0, bodyZ = bodyZ0 + bodyLen / 2;

  const parts = [
    P("frame", "body", null, 0, "box", [W * 0.66, 0.24, L * 0.82], [0, -0.12, 0], "dark"),
    P("hood", "hood", "front", 90 * fm, "rbox", [W * 0.66, 0.3, hoodLen], [0, deck + 0.05, -hz + hoodLen / 2 + 0.1], "paint"),
    P("bumperF", "bumper", "front", 100 * fm, "box", [W * 0.86, 0.18, 0.22], [0, -0.14, -hz + 0.05], "rust"),
    P("bumperR", "bumper", "rear", 80 * fm, "box", [W * 0.76, 0.16, 0.2], [0, -0.12, hz - 0.05], "rust"),
    P("lightL", "light", "front", 20, "cylZ", [0.11, 0.12], [-W * 0.22, deck + 0.08, -hz + 0.1], "light"),
    P("lightR", "light", "front", 20, "cylZ", [0.11, 0.12], [W * 0.22, deck + 0.08, -hz + 0.1], "light"),
  ];
  const cab = bus ? { top: deck + 1.8, parts: [] } : cabParts(p.cab.id, { W, deck, z: cabZ, len: cabLen, h: CAB_PARTS[p.cab.id].h }, statMul(p.cab.tier));
  const body = bodyParts(p.body.id, { W, deck, z: bodyZ, len: bodyLen }, statMul(p.body.tier));
  parts.push(...cab.parts, ...body.parts);
  const top = Math.max(cab.top, body.top), roofZ = bus ? bodyZ : cabZ, roofLen = bus ? bodyLen * 0.8 : cabLen * 0.8;

  // Wheels: front pair steers, the rear (and middle) pairs drive.
  const wy = -F.ride + sus / 2 - PHYSICS.staticComp + r, ww = 0.3 + r * 0.25, wx = W / 2 - 0.04;
  const zf = -hz + Math.max(0.7, L * 0.17), zr = hz - Math.max(0.75, L * 0.2);
  const axles = F.wheels === 6 ? [[zf, true, false], [zr - 2 * r - 0.25, false, true], [zr, false, true]] : [[zf, true, false], [zr, false, true]];
  const wheels = axles.flatMap(([z, steer, drive], i) => {
    const n = ["F", "M", "R"][F.wheels === 6 ? i : i * 2];
    return [Wh(`w${n}L`, -wx, wy, z, r, ww, steer, drive), Wh(`w${n}R`, wx, wy, z, r, ww, steer, drive)];
  });

  // Hardpoints: small mounts on the cab roof, medium and large along the body.
  const sizes = mountList(p.chassis.id), nSide = sideMounts(p.chassis.id), nS = sizes.filter((s) => s === "S").length - nSide, nM = sizes.filter((s) => s === "M").length, nL = sizes.length - nSide - nS - nM;
  const bodyTop = bus ? top : p.body.id === "openbed" ? deck + 0.35 : body.top;
  let iS = 0, iM = 0, iL = 0;
  const hardpoints = sizes.map((size, k) => {
    const side = mountSide(p.chassis.id, k); // round 14: a small mount on each flank, just under the body's top edge
    if (side) return { id: side === "left" ? "sl" : "sr", size, side, pos: [(side === "left" ? -1 : 1) * (W / 2 + 0.14), bodyTop - 0.4, bodyZ] };
    const id = `${size.toLowerCase()}${k + 1}`;
    if (size === "S") { const x = nS > 1 ? (iS++ ? 1 : -1) * W * 0.19 : 0; return { id, size, pos: [x, (bus ? top : cab.top) + 0.02, bus ? -hz + hoodLen + 1 : cabZ] }; }
    if (size === "M") {
      const i = iM++;
      if (nL) return { id, size, pos: [(i ? 1 : -1) * W * 0.27, bodyTop + 0.02, bodyZ - bodyLen * 0.3] };
      return { id, size, pos: [0, bodyTop + 0.02, bodyZ + (i - (nM - 1) / 2) * bodyLen * 0.45] };
    }
    const j = iL++;
    return { id, size, pos: [0, bodyTop + 0.02, bodyZ + bodyLen * 0.1 + (j - (nL - 1) / 2) * bodyLen * 0.42] };
  });

  const bottom = -F.ride + 0.38, hy = (top + 0.05 - bottom) / 2, cy = (top + 0.05 + bottom) / 2;
  const nSph = Math.max(2, Math.ceil(L / 1.9));
  return {
    parts, wheels, susLen: sus, hardpoints,
    armour: {
      front: [[W * 0.8, 0.42, 0.1], [0, 0, -hz - 0.04]], rear: [[W * 0.72, 0.4, 0.1], [0, 0.05, hz + 0.04]],
      left: [[0.1, 0.42, L * 0.5], [-(W / 2 + 0.03), 0, 0]], right: [[0.1, 0.42, L * 0.5], [W / 2 + 0.03, 0, 0]],
      top: [[W * 0.58, 0.08, roofLen], [0, top + 0.04, roofZ]],
    },
    hit: { half: [W / 2 + 0.05, hy, hz], center: [0, cy, 0] },
    spheres: Array.from({ length: nSph }, (_, i) => ({ z: -hz + W / 2 + (i * (L - W)) / (nSph - 1), y: 0, r: W / 2 })),
    exhausts: eng.power >= 30 ? [[W * 0.4, top + 0.5, cabZ + cabLen / 2]] : [[-W * 0.16, deck + 0.4, hz - 0.02], [W * 0.16, deck + 0.4, hz - 0.02]],
    engineSound: eng.sound || "rasp",
    workshop: true,
  };
}