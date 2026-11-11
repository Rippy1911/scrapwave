// Quarry Pit (round 15): a 320 m working quarry at midday. The north half climbs in two benches (4 m and 8 m) with
// radial ramps and long haul-road ramps at their ends; the benches are the high outer route, a ground-level haul
// road with rock berms runs round the south half. In the pit: the spoil heap (9 m, ramps both ends), boulders, a
// flooded sump, a dead haul truck and a conveyor on legs you can drive under.
// Landmark: the Bucket Wheel, a 42 m excavator wheel on the top bench, lit red on its mast.
import { createLayout, D2R } from "@/game/maps/layout";

const B1 = 4, B2 = 8;

function build() {
  const B = createLayout({ R: 160, floor: "sand", wall: "rock", tint: "#a07f5a", sky: { hour: 12.5, weather: "clear" },
    landmark: { name: "The Bucket Wheel", x: 0, z: -136 } });
  const { polar, pt } = B, P = (deg, r) => polar(deg * D2R, r);

  // Benches (north half: angle 180 is north) and their ramps.
  B.band("rock", 100, 122, B1, 110 * D2R, 250 * D2R, 22);
  B.band("rock", 122, 150, B2, 125 * D2R, 235 * D2R, 20);
  for (const deg of [130, 180, 230]) { const [x, z] = P(deg, 93); B.ramp(x, z, 10, 14, B1, deg * D2R + Math.PI, { m: "rock" }); }
  for (const deg of [150, 210]) { const [x, z] = P(deg, 115); B.ramp(x, z, 10, 14, B2 - B1, deg * D2R + Math.PI, { m: "rock", y: B1 }); }
  for (const [deg, s] of [[105.9, 1], [254.1, -1]]) { const [x, z] = P(deg, 111); B.ramp(x, z, 12, 16, B1, deg * D2R - s * Math.PI / 2, { m: "rock" }); }
  for (const [deg, s] of [[119.1, 1], [240.9, -1]]) { const [x, z] = P(deg, 136); B.ramp(x, z, 12, 28, B2, deg * D2R - s * Math.PI / 2, { m: "rock" }); }
  // Cover on the benches: rock lumps and a crate stack.
  for (const [deg, r, y, s] of [[170, 111, B1, 3], [190, 109, B1, 3.6], [140, 140, B2, 4], [222, 138, B2, 3.4]]) { const [x, z] = P(deg, r); B.solid("rock", x, z, s, s * 0.8, s * 1.2, deg * 0.1, y); }

  // The Bucket Wheel on the top bench: body, boom, the wheel with its buckets, the mast and the light.
  const W = { x: 0, z: -136, y: B2 };
  B.solid("#c99a2e", W.x, W.z + 4, 16, 8, 14, 0, W.y);
  B.deco("dark", W.x, W.z + 4, 10, 4, 9, 0, W.y + 8);
  B.deco("#c99a2e", W.x, W.z + 20, 3.2, 3, 30, 0, W.y + 16, { rx: 0.5 });
  B.disc("rust", W.x, W.z + 34, 14, 2.6, W.y + 28 - 1.3, { rz: Math.PI / 2 });
  B.disc("dark", W.x, W.z + 34, 3, 4, W.y + 28 - 2, { rz: Math.PI / 2 });
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * Math.PI * 2, y = W.y + 28 + Math.cos(t) * 14, z = W.z + 34 + Math.sin(t) * 14;
    B.deco("dark", W.x, z, 3.4, 2.4, 3, 0, y - 1.2, { rx: t });
  }
  B.post("dark", W.x, W.z - 4, 0.6, 26, W.y + 8);
  B.deco("dark", W.x, W.z + 8, 0.4, 0.4, 26, 0, W.y + 30, { rx: -0.45 });
  B.lamp(W.x, W.z - 4, W.y + 34.8, 1.8);
  B.lamp(W.x, W.z + 34, W.y + 42.6, 1.2, "lamp");

  // The pit: the spoil heap, boulders, the sump, the haul truck, the conveyor.
  B.mesa("sand", 0, 20, 34, 26, 9, 0, "ns", { len: 26, rw: 11, rm: "sand" });
  for (const [x, z, s] of [[-8, 16, 3], [9, 24, 2.6]]) B.solid("rock", x, z, s, s * 0.8, s, x, 9);
  for (const [x, z, s] of [[-40, 30, 6], [42, -20, 7], [-30, -40, 5], [60, 75, 8], [-62, 82, 7], [-85, -30, 6], [88, 30, 5.5], [38, -88, 5],
    [-18, -82, 4.5], [70, -55, 6], [-50, -8, 4], [35, 95, 6]]) B.solid("rock", x, z, s, s * 0.75, s * 1.15, x * 0.07, 0);
  B.deco("water", 0, 70, 40, 0.05, 26, 0, 0.03);
  B.solid("#c99a2e", 45, 40, 8, 3.4, 14, 0.4); B.deco("rust", 45.4, 41, 7.6, 2.4, 9, 0.4, 3.4, { rx: -0.35 });
  for (const [dx, dz] of [[-4.4, -4.6], [4.4, -4.6], [-4.4, 4.6], [4.4, 4.6]]) { const [x, z] = B.at(45, 40, 0.4, dx, dz); B.deco("rubber", x, z, 1.4, 2.6, 2.6, 0.4, 0); }
  const C0 = [-120, 30], C1 = [-50, 50], len = Math.hypot(C1[0] - C0[0], C1[1] - C0[1]), cr = Math.atan2(C1[0] - C0[0], C1[1] - C0[1]);
  B.solid("rust", (C0[0] + C1[0]) / 2, (C0[1] + C1[1]) / 2, 4, 0.8, len, cr, 6);
  const px = Math.cos(cr) * 1.6, pz = -Math.sin(cr) * 1.6; // across the belt
  for (let k = 0; k <= 6; k++) { const f = k / 6, x = C0[0] + (C1[0] - C0[0]) * f, z = C0[1] + (C1[1] - C0[1]) * f; B.post("dark", x - px, z - pz, 0.3, 6); B.post("dark", x + px, z + pz, 0.3, 6); }

  // The south haul road: berms with gaps on the inside of the lane.
  B.band("rock", 124, 128, 1.3, -100 * D2R, 100 * D2R, 18, (a) => Math.abs(Math.sin(a * 4.5)) < 0.45);
  for (const deg of [-60, 0, 60]) { const [x, z] = P(deg, 144); B.ramp(x, z, 8, 9, 2, deg * D2R - Math.PI / 2, { m: "rust", curve: 1.6 }); }

  for (let i = 0; i < 10; i++) { const p = pt(i * 36 + 18, 70); B.spawn(p.x, p.z); }
  for (const [deg, r, y] of [[0, 140], [60, 140], [120, 111, B1], [160, 136, B2], [200, 111, B1], [240, 111, B1], [300, 140], [270, 60], [90, 50]]) { const p = pt(deg, r, y); B.cp(p.x, p.z, p.y); }
  B.cp(0, 20, 9);
  for (const [deg, r, y] of [[30, 140], [330, 140], [143, 111, B1], [217, 111, B1], [168, 144, B2], [100, 60], [260, 60]]) { const p = pt(deg, r, y); B.power(p.x, p.z, p.y); }
  B.power(0, 20, 9);
  for (const deg of [0, 40, 80, 120, 160, 200, 240, 280, 320]) { const p = pt(deg, deg > 100 && deg < 260 ? 111 : 138, deg > 100 && deg < 260 ? B1 : 0); B.horde(p.x, p.z, p.y); }
  B.horde(0, 70);
  for (const [x, z] of [[-20, 50], [30, 60], [40, -45], [-70, 10], [80, 0], [-35, -65]]) { B.prop("barrel", x, z); B.prop("barrel", x + 1.3, z + 0.5); B.prop("crate", x - 1.5, z - 0.8); }
  for (const deg of [130, 180, 230]) { const [x, z] = P(deg + 6, 96); B.prop("sign", x, z, deg * D2R); }
  for (const deg of [-80, -40, 40, 80]) { const [x, z] = P(deg, 120); B.prop("fence", x, z, deg * D2R + Math.PI / 2); }
  for (const deg of [20, 100, 260, 340]) { const [x, z] = P(deg, 150); B.prop("pole", x, z); }
  return B.done();
}

export const QUARRY_PIT = {
  id: "quarry-pit", kind: "arena", name: "Quarry Pit", landmark: "The Bucket Wheel", size: [320, 320], build,
  blurb: "A working quarry: two benches of high ground in the north, a spoil heap and a sump in the pit, a haul road round the south.",
  tip: "The Bucket Wheel stands on the top bench. The long haul ramps at the bench ends are the fast way up.",
};