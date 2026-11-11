// Gamepad chords for moving machines (round 12). Only while you drive a machine with joints, LB (button 4) is a
// modifier; without a machine every button keeps its normal job. With LB held:
//   D-pad up / right / down / left  joint keys 1 / 2 / 3 / 4 (held, like the number keys)
//   A / B                           joint keys 5 / 6
//   Y                               T (fold between Drive and Walker mode)
//   X                               ram fist (punch only, the guns stay quiet)
// LB alone still changes the camera, on release, when no chord was used.
export const PAD_DIGITS = { 12: 1, 15: 2, 13: 3, 14: 4, 0: 5, 1: 6 };
export const PAD_MECH_EDGES = { 3: "emote", 2: "punch" };
export const PAD_CHORD_BUTTONS = new Set([0, 1, 2, 3, 12, 13, 14, 15]);

// b(i) -> pressed now, prev[i] -> pressed last frame. Returns { held: Set of key codes, edges: [action names] }.
export function padMech(b, prev) {
  const held = new Set(), edges = [];
  for (const [i, n] of Object.entries(PAD_DIGITS)) if (b(+i)) held.add("Digit" + n);
  for (const [i, name] of Object.entries(PAD_MECH_EDGES)) if (b(+i) && !prev[i]) edges.push(name);
  return { held, edges };
}