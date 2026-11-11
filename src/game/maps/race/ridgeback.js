// Ridgeback Pass (round 15): a mountain road in the morning. From the start on the valley floor: six hairpins up
// the south face, the climb round the shoulder, the crossing on top of the dam, the jump off the cliff edge and the
// long downhill in three sweeps back to the valley. Fall off and you are put back on the road.
// Landmark: Greywater Dam.
import { createRaceLayout } from "@/game/maps/race/raceLayout";
import { roundCorners } from "@/game/maps/race/trackPath";

const H = { w: 12, zone: "hairpins", r: 30 }, C = { w: 12, zone: "climb" }, D = { w: 13, zone: "descent" };
const DAM = { x: 100, z: -260, y: 68 };
const VERTS = [
  [-400, 330, { w: 14, zone: "valley", y: 1.2 }], [60, 330, { w: 14, zone: "valley", y: 1.2 }],
  [300, 330, { ...H, y: 1.2 }], [300, 262, { ...H, y: 4 }], [-90, 262, { ...H, y: 13 }], [-90, 194, { ...H, y: 16 }],
  [300, 194, { ...H, y: 25 }], [300, 126, { ...H, y: 28 }], [-90, 126, { ...H, y: 37 }], [-90, 58, { ...H, y: 40 }],
  [220, 58, { ...C, y: 46 }], [430, 30, { ...C, r: 90, y: 51 }], [440, -260, { ...C, r: 90, y: 67 }],
  [310, -260, { w: 11, zone: "dam", y: DAM.y }], [-110, -260, { ...C, zone: "ridge", y: DAM.y }],
  [-240, -260, { ...C, zone: "ridge", y: 68 }], [-280, -260, { ...C, zone: "ridge", y: 71, gap: true }], [-306, -260, { ...D, y: 63 }], [-360, -260, { ...D, y: 62 }],
  [-520, -260, { ...D, r: 90, y: 57 }], [-620, -60, { ...D, r: 120, y: 40 }], [-480, 120, { ...D, r: 120, y: 22 }], [-640, 330, { ...D, r: 70, y: 4 }],
];

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// The mountain away from the road: rising to the north, ridges across it, the gorge the dam closes.
function far(x, z) {
  const rise = 66 * Math.max(0, Math.min(1.25, (300 - z) / 560)), ridges = 9 * Math.sin(x / 110) * Math.cos(z / 85) + 5 * Math.sin((x + z) / 47);
  const gorge = Math.exp(-(((x - DAM.x) / 150) ** 2)) * smooth(140, -120, z) * 50;
  return rise + ridges * smooth(310, 200, z) - gorge + smooth(560, 760, Math.abs(x)) * 60;
}

function build() {
  const B = createRaceLayout({ track: { points: roundCorners(VERTS), width: 12 }, floor: "rock", outer: "rock", tint: "#6a5a4a", fall: 3,
    sky: { hour: 9, weather: "clear" }, lapTime: 165, margin: 150, landmark: { name: "Greywater Dam", x: DAM.x, z: DAM.z } });
  const S = B.samples;
  // The ground: level with the road for 28 m either side, the mountain beyond 80 m, blended between.
  B.L.terrain = (x, z) => {
    let best = null, bd = Infinity;
    for (let i = 0; i < S.length; i += 2) { const p = S[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
    const m = far(x, z);
    if (best.gap || best.zone === "dam") return Math.max(0.3, Math.min(m, best.y - 6));
    return Math.max(0.3, best.y - 0.7 + (m - best.y + 0.7) * smooth(28, 80, Math.sqrt(bd)));
  };

  // The dam: its wall under the road, the reservoir behind it, a tower at each end.
  B.deco("concrete", DAM.x, DAM.z, 440, DAM.y - 1.2, 18);
  B.deco("concrete", DAM.x, DAM.z + 16, 440, DAM.y * 0.55, 16);
  B.deco("water", DAM.x, DAM.z - 150, 470, 0.4, 280, 0, DAM.y - 4);
  for (const dx of [-215, 215]) { B.deco("concrete", DAM.x + dx, DAM.z - 14, 10, 14, 10, 0, DAM.y - 2); B.lamp(DAM.x + dx, DAM.z - 14, DAM.y + 13.5, 1.6, "lamp"); }
  // The cliff edge: warning lights at the lip, rock teeth below the landing.
  B.zone("ridge", 4, (p, side) => {
    if (!p.gap || S[(S.indexOf(p) + S.length - 1) % S.length].gap) return;
    for (const sd of [-1, 1]) { const [x, z] = side(sd * (p.w / 2 + 1.2)); B.post("rust", x, z, 0.3, 4, p.y, false); B.lamp(x, z, p.y + 4.3, 0.8); }
  });
  // Rocks outside the barriers, signs before the hairpins.
  let k = 0;
  B.zone(null, 64, (p, side) => {
    if (p.gap || p.zone === "dam") return;
    const sd = k++ % 2 ? 1 : -1, s = 2.5 + (k % 4) * 1.3, [x, z] = side(sd * (p.w / 2 + 5 + s));
    B.deco("rock", x, z, s * 2, s * 1.5, s * 1.7, k * 0.9, p.y - 0.8, { rz: 0.2 });
  });
  B.zone("hairpins", 150, (p, side) => B.prop("sign", ...side(p.w / 2 - 0.9), p.r, p.y));
  B.zone(null, 480, (p) => B.power(p.x, p.z, p.y));
  B.zone("valley", 90, (p) => B.horde(p.x, p.z, p.y));
  return B.done();
}

export const RIDGEBACK_PASS = {
  id: "ridgeback", kind: "race", name: "Ridgeback Pass", landmark: "Greywater Dam", laps: 2, size: [1600, 1100], build,
  blurb: "A mountain road: six hairpins up the south face, the crossing on top of the dam, a jump off the cliff edge and the long downhill.",
  tip: "Brake before each hairpin, not in it. Carry speed along the ridge: the cliff jump needs it.",
};