// Container Port (round 15): a 330 m round dock in the morning, open water past the wall. A grid of container
// blocks with lanes between them; the north and south rows are 5.2 m container decks joined by plank bridges, an
// elevated route you climb by ramps at the far ends and from the middle. The outer route is the clear quay lane
// along the wall. Landmark: the Gantry, a 44 m crane straddling the east lane with its boom reaching the middle.
import { createLayout, D2R } from "@/game/maps/layout";

const DECK = 5.2, CL = 12.2, CW = 2.6; // container length and width (and height)
const COLORS = ["#a8462c", "#2f5d7a", "#c99a2e", "#4f6b3a", "#8a8f94", "#6a3a5a"];
const hash = (i) => { const s = Math.sin(i * 91.7 + 3.1) * 43758.5; return s - Math.floor(s); };

function build() {
  const B = createLayout({ R: 165, floor: "concrete", outer: "water", wall: "corrugated", horizon: "rock", tint: "#7d7a72",
    sky: { hour: 8.2, weather: "clear" }, landmark: { name: "The Gantry", x: 75, z: 0 } });
  const { polar, pt } = B;
  let n = 0;
  const stack = (x, z, r, levels) => { for (let l = 0; l < levels; l++) B.solid(COLORS[(n + l * 2) % 6], x, z, CL, CW, CW, r, l * CW); n++; };

  // The elevated rows: three decks each north (z -75) and south (z 75), bridges over the lanes between them.
  for (const zr of [-75, 75]) {
    for (const x of [-75, 0, 75]) {
      const sides = x === -75 ? "w" : x === 75 ? "e" : zr < 0 ? "s" : "n";
      B.mesa(COLORS[(x / 75 + 1 + (zr > 0 ? 3 : 0)) % 6], x, zr, 3 * CL, 5 * CW, DECK, 0, sides, { len: 17, rw: 10, rm: "rust" });
      for (const dx of [-CL / 2, CL / 2]) B.deco("dark", x + dx, zr, 0.15, DECK - 0.4, 5 * CW + 0.1, 0, 0.2);
      for (const dz of [-2, 2]) B.deco("rust", x, zr + dz * CW, 3 * CL + 0.1, 0.12, 0.12, 0, DECK);
    }
    for (const x of [-37.5, 37.5]) { B.solid("wood", x, zr, 38.6, 0.6, 7, 0, DECK - 0.6); B.deco("dark", x, zr - 3.4, 38.6, 1, 0.15, 0, DECK); B.deco("dark", x, zr + 3.4, 38.6, 1, 0.15, 0, DECK); }
  }

  // West maze block: stacks one to three high, turned to make alleys.
  for (const [x, z, r, l] of [[-92, -22, 0, 2], [-92, -16, 0, 1], [-70, -28, Math.PI / 2, 3], [-58, -10, 0, 1], [-84, 4, 0.3, 2],
    [-62, 14, Math.PI / 2, 2], [-96, 24, 0, 3], [-74, 30, 0, 1], [-52, 30, -0.4, 2]]) stack(x, z, r, l);
  // The gantry lane (x 75): stacks either side.
  for (const z of [-38, -24, 24, 38]) { stack(55, z, Math.PI / 2, 2); stack(95, z, Math.PI / 2, z > 0 ? 3 : 1); }
  // The middle: the scale house (4 m, ramps north and south) with kickers on its east and west.
  B.mesa("concrete", 0, 0, 14, 12, 4, 0, "ns", { len: 13, rw: 8 });
  B.deco("corrugated", 0, 0, 8, 3, 6, 0, 4);
  for (const s of [-1, 1]) B.ramp(s * 28, 0, 8, 9, 2.2, s * Math.PI / 2, { m: "rust", curve: 1.6 });
  // Single boxes as cover around the yard, and along the inside of the quay lane.
  for (const [x, z, r] of [[-30, -38, 0.2], [30, -40, -0.3], [-34, 40, 1.4], [34, 36, 1.7], [-26, 18, 1.2], [24, -16, 0.4]]) stack(x, z, r, 1);
  B.ring(12, 128, (a, x, z, w, i) => { if (i % 3 !== 1) stack(x, z, a + Math.PI / 2 + (hash(i) - 0.5) * 0.6, i % 4 ? 1 : 2); }, 0.2);

  // The Gantry: four legs over the east lane, girders, the boom out west over the middle, the cab and lights.
  for (const [x, z] of [[64, -20], [86, -20], [64, 20], [86, 20]]) B.post("#c99a2e", x, z, 1, 40);
  for (const z of [-20, 20]) B.deco("#c99a2e", 75, z, 24, 2.4, 2.4, 0, 40);
  for (const x of [64, 86]) B.deco("#c99a2e", x, 0, 2.4, 2.4, 42, 0, 40);
  B.deco("#c99a2e", 38, 0, 96, 2.2, 3, 0, 42.4);
  B.deco("dark", 75, 0, 10, 5, 8, 0, 44.6);
  B.deco("#8a8f94", 30, 0, 4, 3, 4, 0, 38.6);
  for (const dx of [-4, 4]) B.deco("dark", 30 + dx, 0, 0.12, 8, 0.12, 0, 30.6);
  B.deco("#2f5d7a", 30, 0, CL, CW, CW, 0, 28);
  B.lamp(75, 0, 51, 1.8); B.lamp(-9, 0, 45.4, 1.2); B.lamp(64, -20, 41, 1, "lamp"); B.lamp(86, 20, 41, 1, "lamp");
  // Bollards along the quay.
  B.ring(40, 160, (a, x, z) => B.post("dark", x, z, 0.4, 0.9, 0, false));

  for (let i = 0; i < 10; i++) { const p = pt(i * 36 + 18, 146); B.spawn(p.x, p.z); }
  for (const [x, z, y] of [[-75, -75, DECK], [0, -75, DECK], [75, -75, DECK], [75, 0], [0, 0, 4], [-75, 0], [-75, 75, DECK], [0, 75, DECK], [75, 75, DECK], [0, 140]]) B.cp(x, z, y || 0);
  for (const [x, z, y] of [[-37.5, -75, DECK], [37.5, 75, DECK], [75, 30], [-60, 0], [40, 0], [0, -40], [0, 40], [-100, -100]]) B.power(x, z, y || 0);
  for (const deg of [15, 55, 95, 135, 175, 215, 255, 295, 335]) { const p = pt(deg, 140); B.horde(p.x, p.z); }
  B.horde(-40, 0);
  for (const [x, z] of [[-40, -20], [44, 18], [-20, -55], [20, 55], [110, -40], [-110, 40]]) { B.prop("barrel", x, z); B.prop("barrel", x + 1.2, z + 0.6); B.prop("crate", x - 1.5, z - 0.8); }
  for (const [x, z, r] of [[-40, -52, 0], [40, 52, 0], [-50, 40, Math.PI / 2], [46, -46, Math.PI / 2]]) B.prop("fence", x, z, r);
  for (const deg of [30, 120, 210, 300]) { const [x, z] = polar(deg * D2R, 152); B.prop("pole", x, z); }
  B.prop("sign", 75, -48, 0); B.prop("sign", -110, 0, Math.PI / 2);
  return B.done();
}

export const CONTAINER_PORT = {
  id: "container-port", kind: "arena", name: "Container Port", landmark: "The Gantry", size: [330, 330], build,
  blurb: "A round dock of container lanes, two elevated container rows joined by bridges and the quay lane around it all.",
  tip: "The Gantry's red light stands over the east lane. Climb the container rows at their ends for the high road.",
};