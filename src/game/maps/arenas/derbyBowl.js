// Derby Bowl (round 15): a 310 m dirt bowl for demolition derbies, at dusk. The pit in the middle is ringed by a 3 m
// bank with ramps up and four cuts through it. Outside the bank runs the outer route, a lap lane along the wall with
// concrete chicanes, floodlights and two 7 m grandstands (north and south) you can drive onto.
// Landmark: the Crusher, a tower of crushed cars under a 52 m mast in the middle of the pit, lit red on top.
import { createLayout, D2R } from "@/game/maps/layout";

const BANK = 3, STAND = 7;
const CARS = ["#7a2410", "#2f5d7a", "#8a7a3a", "#4f5a44", "#6b6f72", "#9a5a1f"];
const cutAt = (a) => [45, 135, 225, 315].some((c) => Math.abs((((a / D2R - c) % 360) + 540) % 360 - 180) < 7);

function build() {
  const B = createLayout({ R: 155, floor: "sand", wall: "concrete", tint: "#9a7a52", sky: { hour: 18.4, weather: "clear" },
    landmark: { name: "The Crusher", x: 0, z: 0 } });
  const { polar, pt } = B, P = (deg, r) => polar(deg * D2R, r);

  // The Crusher: shrinking blocks of crushed cars, each turned a little, then the mast, a lamp ring and the light.
  for (let lv = 0; lv < 8; lv++) { const s = 12 - lv * 1.05; B.solid(CARS[lv % 6], 0, 0, s, 2.1, s * 0.85, lv * 0.37, lv * 2.1); }
  B.post("dark", 0, 0, 0.7, 34, 16.8);
  B.deco("dark", 0, 0, 9, 0.5, 0.5, 0, 46); B.deco("dark", 0, 0, 0.5, 0.5, 9, 0, 46);
  for (const [x, z] of [[4.3, 0], [-4.3, 0], [0, 4.3], [0, -4.3]]) B.lamp(x, z, 46.9, 1, "lamp");
  B.lamp(0, 0, 51.6, 1.8);
  for (let k = 0; k < 6; k++) { const [x, z] = P(k * 60 + 15, 28); for (const [dx, dz] of [[0, 0], [1.9, 0.4], [0.9, 1.7]]) B.post("rubber", x + dx, z + dz, 0.9, 2.4); }

  // The pit: tangential kickers, crushed-car piles for cover.
  for (const deg of [0, 90, 180, 270]) { const [x, z] = P(deg, 55); B.ramp(x, z, 8, 9, 2.2, deg * D2R - Math.PI / 2, { m: "rust", curve: 1.6 }); }
  for (let k = 0; k < 8; k++) {
    const deg = 22.5 + k * 45, [x, z] = P(deg, 72), a = deg * D2R;
    B.solid(CARS[k % 6], x, z, 5.2, 1.6, 2.6, a + 0.3);
    B.solid(CARS[(k + 2) % 6], x + 1.2, z - 0.6, 4.6, 1.5, 2.4, a - 0.4, 1.6);
    B.solid(CARS[(k + 4) % 6], x - 3.4, z + 2.2, 4.8, 1.6, 2.5, a + 1.2);
  }

  // The bank (r 95-109) with four cuts, ramps up from the pit and from the outer route.
  B.band("rock", 95, 109, BANK, 0, Math.PI * 2, 40, cutAt);
  for (const deg of [0, 90, 180, 270]) { const [x, z] = P(deg, 89.5); B.ramp(x, z, 9, 11, BANK, deg * D2R + Math.PI); }
  for (const deg of [20, 110, 200, 290]) { const [x, z] = P(deg, 114.5); B.ramp(x, z, 9, 11, BANK, deg * D2R); }

  // Grandstands (r 129-147) north and south, a ramp up at each end, parapets and a canopy on posts.
  for (const c of [0, 180]) {
    B.band("concrete", 129, 147, STAND, (c - 22) * D2R, (c + 22) * D2R, 6);
    for (const off of [-12, 12]) { const [x, z] = P(c + off, 121); B.ramp(x, z, 9, 16, STAND, (c + off) * D2R + Math.PI, { m: "rust" }); }
    B.ring(6, 129.6, (a, x, z, w, i) => { if (i !== 1 && i !== 4) B.solid("concrete", x, z, w - 1, 1.2, 0.6, a, STAND); }, (c - 22) * D2R, (c + 22) * D2R);
    B.ring(5, 145.5, (a, x, z) => B.post("dark", x, z, 0.35, 6, STAND), (c - 20) * D2R, (c + 20) * D2R);
    B.ring(5, 141, (a, x, z, w) => B.deco("corrugated", x, z, w + 0.5, 0.3, 11, a, STAND + 6), (c - 20) * D2R, (c + 20) * D2R);
  }

  // Outer route: concrete chicanes in the lane and floodlights against the wall.
  for (const deg of [60, 120, 240, 300]) {
    for (const [d, r] of [[-3, 114], [3, 124]]) { const [x, z] = P(deg + d, r); B.solid("concrete", x, z, 6, 1.1, 1, (deg + d) * D2R + Math.PI / 2); }
  }
  for (const deg of [45, 135, 225, 315]) {
    const [x, z] = P(deg, 149);
    B.post("dark", x, z, 0.5, 26); B.deco("dark", x, z, 4, 1.4, 1, deg * D2R, 26); B.lamp(x, z, 27.6, 1.6, "lamp");
  }

  for (let i = 0; i < 10; i++) { const p = pt(i * 36 + 18, 45); B.spawn(p.x, p.z); }
  for (const [deg, r, y] of [[10, 40], [45, 102], [90, 102, BANK], [135, 120], [180, 138, STAND], [225, 80], [270, 102, BANK], [315, 125], [0, 138, STAND], [200, 60]]) { const p = pt(deg, r, y); B.cp(p.x, p.z, p.y); }
  for (const [deg, r, y] of [[30, 75], [120, 75], [210, 75], [300, 75], [90, 102, BANK], [270, 102, BANK], [180, 138, STAND], [0, 138, STAND]]) { const p = pt(deg, r, y); B.power(p.x, p.z, p.y); }
  for (const [deg, r] of [[35, 122], [80, 122], [100, 122], [145, 122], [215, 122], [260, 122], [280, 122], [325, 122], [0, 66], [180, 66]]) { const p = pt(deg, r); B.horde(p.x, p.z); }
  for (let k = 0; k < 8; k++) {
    const [x, z] = P(22.5 + k * 45, 64);
    B.prop("barrel", x, z); B.prop("barrel", x + 1.3, z + 0.5); B.prop("crate", x - 1.4, z - 0.9);
  }
  for (const deg of [45, 135, 225, 315]) { const [x, z] = P(deg + 4, 102); B.prop("sign", x, z, deg * D2R); }
  for (const deg of [-18, -6, 6, 18, 162, 174, 186, 198]) { const [x, z] = P(deg, 127); B.prop("fence", x, z, deg * D2R + Math.PI / 2); }
  for (const deg of [70, 110, 250, 290]) { const [x, z] = P(deg, 133); B.prop("pole", x, z); }
  return B.done();
}

export const DERBY_BOWL = {
  id: "derby-bowl", kind: "arena", name: "Derby Bowl", landmark: "The Crusher", size: [310, 310], build,
  blurb: "A dirt bowl at dusk: the pit, a bank with four cuts, an outer lap lane and two grandstands to jump from.",
  tip: "The red light on the Crusher marks the middle of the bowl. Bank ramps throw you into the outer lane.",
};