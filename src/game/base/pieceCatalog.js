// Free-build pieces for the build view (besides the modules): walls, ramps, platforms, gates, towers, barriers,
// bridges and props. Sizes are metres [w, h, d], the origin is the bottom centre. Each piece is built in one
// material (materials.js) and one tier. Fortress-only pieces (core, turret) are not on the build bar.
import { matStats } from "@/game/base/materials";

export const PIECE_CAP = 120; // pieces per plot: keeps the frame rate (the build view shows it)
export const WORLD_PIECE_CAP = 700; // every piece in the world (plots + fortresses)

export const PIECES = {
  wall: { name: "Wall", size: [4, 3, 0.6], vol: 1, icon: "wall" },
  halfwall: { name: "Half wall", size: [2, 3, 0.6], vol: 1, icon: "wall" },
  barrier: { name: "Barrier", size: [4, 1.2, 0.9], vol: 0.9, icon: "barrier" },
  gate: { name: "Gate", size: [6, 3.6, 0.6], vol: 0.8, icon: "gate", gate: true },
  ramp: { name: "Ramp", size: [4, 1.6, 7], vol: 0.5, icon: "ramp", wedge: true },
  platform: { name: "Platform", size: [4, 0.4, 4], vol: 1, icon: "platform" },
  pillar: { name: "Pillar", size: [0.8, 3, 0.8], vol: 1, icon: "pillar" },
  tower: { name: "Tower", size: [3, 7, 3], vol: 0.35, icon: "tower" },
  bridge: { name: "Bridge", size: [8, 0.5, 3.5], vol: 1, icon: "bridge" },
  crate: { name: "Crate", size: [1.6, 1.6, 1.6], vol: 1, icon: "crate", prop: true },
  barrels: { name: "Barrels", size: [1.4, 1.3, 1.4], vol: 0.8, icon: "barrels", prop: true },
  sandbags: { name: "Sandbags", size: [3, 0.9, 1], vol: 1, icon: "sandbags", prop: true },
  lamp: { name: "Lamp post", size: [0.4, 4.5, 0.4], vol: 1, icon: "lamp", prop: true },
  // fortress only
  core: { name: "Fortress core", size: [4, 4.2, 4], vol: 0.9, icon: "core", fortOnly: true },
  turret: { name: "Fort turret", size: [2, 2.2, 2], vol: 0.8, icon: "turret", fortOnly: true },
};

export const PIECE_IDS = Object.keys(PIECES).filter((k) => !PIECES[k].fortOnly);
export const isPiece = (k) => !!PIECES[k];
export const pieceDef = (k) => PIECES[k] || PIECES.wall;

// Footprint [w, d] for a yaw: exact for quarter turns, the bounding box otherwise.
export function pieceFoot(kind, yaw = 0) {
  const [w, , d] = pieceDef(kind).size, c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  return [w * c + d * s, w * s + d * c];
}

export function pieceVolume(kind) {
  const [w, h, d] = pieceDef(kind).size;
  return w * h * d * pieceDef(kind).vol;
}

// HP, mass and cost for kind × material × tier.
export const pieceStats = (kind, mat, tier) => matStats(mat, tier, pieceVolume(kind));

// Collider boxes in piece-local metres: [lx, ly, lz, hx, hy, hz, role, shape].
export function pieceBoxes(kind) {
  const def = pieceDef(kind), [w, h, d] = def.size;
  if (def.gate) {
    const post = 0.45;
    return [
      [-(w / 2 - post), h / 2, 0, post, h / 2, d / 2, "post"],
      [w / 2 - post, h / 2, 0, post, h / 2, d / 2, "post"],
      [0, (h - 0.3) / 2, 0, w / 2 - post * 2, (h - 0.3) / 2, d * 0.4, "door"],
    ];
  }
  if (def.wedge) return [[0, h / 2, 0, w / 2, h / 2, d / 2, "", "wedge"]];
  return [[0, h / 2, 0, w / 2, h / 2, d / 2, ""]];
}