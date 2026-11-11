// Raider fortress blueprints: a walled square with corner towers, turrets on the gate-side towers, a gate,
// clutter and the core in the middle. Same piece descriptions as base blueprints, centre-relative, gate at +z
// before the fortress's quarter turn is applied.
const S = 18, Q = Math.PI / 2;

export const FORT_STYLES = {
  rustjaw: { wall: ["sheet", 2], tower: ["steel", 1], gate: ["sheet", 3], core: ["steel", 3] },
  cinder: { wall: ["concrete", 2], tower: ["concrete", 3], gate: ["steel", 2], core: ["steel", 3] },
  gutter: { wall: ["wood", 3], tower: ["sheet", 2], gate: ["wood", 3], core: ["steel", 2] },
};

function raw(style) {
  const st = FORT_STYLES[style] || FORT_STYLES.cinder, out = [];
  const add = (kind, [mat, tier], lx, lz, yaw = 0) => out.push({ kind, mat, tier, lx, lz, yaw });
  for (const x of [-16, -12, -8, -4, 0, 4, 8, 12, 16]) add("wall", st.wall, x, -S); // back
  for (const z of [-16, -12, -8, -4, 0, 4, 8, 12, 16]) { add("wall", st.wall, -S, z, Q); add("wall", st.wall, S, z, Q); }
  for (const x of [-16, -12, -8, 8, 12, 16]) add("wall", st.wall, x, S); // gate side
  for (const s of [-1, 1]) { add("halfwall", st.wall, s * 4, S); add("pillar", st.wall, s * 5.6, S); }
  add("gate", st.gate, 0, S);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add("tower", st.tower, x * S, z * S);
  add("turret", ["steel", 2], -S, S); add("turret", ["steel", 2], S, S); // stack on the gate-side towers
  add("core", st.core, 0, -6);
  add("sandbags", ["concrete", 1], -5, 8); add("sandbags", ["concrete", 1], 5, 8);
  add("barrels", ["sheet", 1], -12, -12); add("barrels", ["sheet", 1], 12, -13);
  add("crate", ["wood", 1], -10, 2); add("crate", ["wood", 1], 11, 4); add("crate", ["wood", 1], 11, 4); // stacked
  add("barrier", ["concrete", 2], 0, S + 7);
  return out;
}

// Rotated by quarter turns q so footprints stay exact.
export function fortLayout(style, q = 0) {
  const t = q * Q, c = Math.cos(t), s = Math.sin(t);
  return raw(style).map((p) => ({ ...p, lx: Math.round((p.lx * c + p.lz * s) * 100) / 100, lz: Math.round((-p.lx * s + p.lz * c) * 100) / 100, yaw: p.yaw + t }));
}

export const FORT_HALF = S + 2;