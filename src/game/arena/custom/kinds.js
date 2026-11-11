// Map builder pieces. Sizes in metres: w across (local x), h tall, d deep (local z). Ramps rise toward local -z.
// group: solid (a box you crash into), ramp (a wedge you drive up), prop (smashable), point (a marker, no shape).
export const KINDS = {
  wall: { name: "Wall", group: "solid", w: 8, h: 3, d: 1, color: "#8a8478" },
  block: { name: "Block", group: "solid", w: 4, h: 3, d: 4, color: "#a8462c" },
  tower: { name: "Tower", group: "solid", w: 4, h: 7, d: 4, color: "#2f5f7a" },
  deck: { name: "Deck", group: "solid", w: 8, h: 2.4, d: 8, color: "#7d8a80" },
  pillar: { name: "Pillar", group: "solid", w: 1.6, h: 7, d: 1.6, color: "#d9b23a" },
  glow: { name: "Glow pylon", group: "solid", w: 1, h: 5, d: 1, color: "#59e0c8", glow: true },
  ramp: { name: "Ramp", group: "ramp", w: 6, h: 2.4, d: 9, color: "#b5651d" },
  kicker: { name: "Big ramp", group: "ramp", w: 8, h: 4, d: 13, color: "#b5651d" },
  barrel: { name: "Barrel", group: "prop", color: "#c0392b" },
  crate: { name: "Crate", group: "prop", color: "#b08d57" },
  fence: { name: "Fence", group: "prop", color: "#9a9285" },
  spawn: { name: "Start spot", group: "point", color: "#7fe0a0" },
  cp: { name: "Checkpoint", group: "point", color: "#f2c230" },
  power: { name: "Power-up", group: "point", color: "#9cc8ff" },
  horde: { name: "Horde nest", group: "point", color: "#c084fc" },
};

export const KIND_IDS = Object.keys(KINDS);
export const MAP_R = 58; // pieces stay inside this radius (the pen wall stands at 64 m)
export const MAX_PIECES = 220;