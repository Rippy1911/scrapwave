// Cab and body pieces of a built car, in the CHASSIS part format (data/vehicles.js) so they shoot off like today's
// panels. Each returns { parts, top } in chassis space: +x right, +y up, -z forward. hm: the part's tier HP factor.
const P = (id, kind, zone, hp, shape, size, pos, mat, extra = {}) => ({ id, kind, zone, hp: Math.round(hp), shape, size, pos, mat, ...extra });
const D = (shape, size, pos, mat, extra = {}) => ({ id: null, kind: "deco", shape, size, pos, mat, ...extra });

// g: { W, deck, z, len, h } — width, deck height, centre z and length of the cab.
export function cabParts(id, g, hm) {
  const { W, deck, z, len, h } = g, front = z - len / 2;
  if (id === "cage") return { top: deck + h, parts: [
    P("cage", "cage", "top", 150 * hm, "cage", [W * 0.6, h, len * 0.95], [0, deck + h / 2, z], "dark"),
    D("rbox", [0.55, 0.55, 0.5], [0, deck + 0.2, z + 0.15], "rubber"),
    P("doorL", "door", "left", 80 * hm, "rbox", [0.08, 0.32, len * 0.75], [-W * 0.37, deck + 0.02, z], "paint"),
    P("doorR", "door", "right", 80 * hm, "rbox", [0.08, 0.32, len * 0.75], [W * 0.37, deck + 0.02, z], "paint"),
    P("glass", "window", "front", 40, "box", [W * 0.5, 0.36, 0.04], [0, deck + 0.4, front + 0.1], "glass", { rot: [-0.45, 0, 0] }),
  ] };
  const armoured = id === "armoured";
  const parts = [
    P("cabin", "body", null, 0, armoured ? "box" : "rbox", [W * 0.84, h, len], [0, deck + h / 2, z], armoured ? "dark" : "paint"),
    P("roof", "roof", "top", (armoured ? 200 : 120) * hm, armoured ? "box" : "rbox", [W * 0.8, 0.09, len * 0.88], [0, deck + h + 0.03, z], armoured ? "rust" : "paint2"),
    P("doorL", "door", "left", (armoured ? 160 : 100) * hm, "rbox", [0.08, h * 0.7, len * 0.7], [-W * 0.43, deck + h * 0.4, z], armoured ? "rust" : "paint2"),
    P("doorR", "door", "right", (armoured ? 160 : 100) * hm, "rbox", [0.08, h * 0.7, len * 0.7], [W * 0.43, deck + h * 0.4, z], armoured ? "rust" : "paint2"),
  ];
  if (armoured) {
    parts.push(P("glassF", "window", "front", 60, "box", [W * 0.6, 0.12, 0.04], [0, deck + h * 0.72, front - 0.03], "glass"));
    parts.push(D("box", [W * 0.86, 0.06, len * 1.01], [0, deck + h * 0.25, z], "chrome"));
  } else {
    parts.push(P("glassF", "window", "front", 40, "box", [W * 0.72, h * 0.6, 0.04], [0, deck + h * 0.62, front - 0.02], "glass", { rot: [-0.45, 0, 0] }));
    parts.push(P("glassL", "window", "left", 30, "box", [0.04, h * 0.4, len * 0.6], [-W * 0.425, deck + h * 0.68, z], "glass"));
    parts.push(P("glassR", "window", "right", 30, "box", [0.04, h * 0.4, len * 0.6], [W * 0.425, deck + h * 0.68, z], "glass"));
  }
  return { top: deck + h + 0.08, parts };
}

// g: { W, deck, z, len } — the body's centre z and length (for the bus: the whole length behind the hood).
export function bodyParts(id, g, hm) {
  const { W, deck, z, len } = g, back = z + len / 2;
  if (id === "openbed") return { top: deck + 0.42, parts: [
    P("bed", "boot", "rear", 120 * hm, "box", [W * 0.84, 0.06, len], [0, deck + 0.03, z], "rust"),
    D("box", [0.06, 0.4, len], [-W * 0.42, deck + 0.2, z], "rust"),
    D("box", [0.06, 0.4, len], [W * 0.42, deck + 0.2, z], "rust"),
    P("gate", "panel", "rear", 80 * hm, "box", [W * 0.8, 0.4, 0.06], [0, deck + 0.2, back], "rust"),
  ] };
  if (id === "cargo") return { top: deck + 1.1, parts: [
    P("box", "body", null, 0, "rbox", [W * 0.86, 1.1, len], [0, deck + 0.55, z], "paint2"),
    P("panelL", "panel", "left", 120 * hm, "box", [0.06, 0.8, len * 0.8], [-W * 0.44, deck + 0.55, z], "rust"),
    P("panelR", "panel", "right", 120 * hm, "box", [0.06, 0.8, len * 0.8], [W * 0.44, deck + 0.55, z], "rust"),
    P("doorB", "door", "rear", 120 * hm, "box", [W * 0.7, 0.9, 0.06], [0, deck + 0.55, back + 0.02], "paint"),
  ] };
  if (id === "tanker") {
    const r = Math.min(0.75, W * 0.4);
    return { top: deck + r * 2 + 0.1, parts: [
      P("tank", "body", null, 0, "cylZ", [r, len * 0.95], [0, deck + r + 0.05, z], "paint2"),
      P("ladder", "panel", "rear", 120 * hm, "box", [0.4, r * 1.6, 0.08], [W * 0.22, deck + r, back], "dark"),
      D("box", [r * 2.1, 0.22, 0.3], [0, deck + r + 0.05, z - len * 0.25], "hazard"),
      D("box", [r * 2.1, 0.22, 0.3], [0, deck + r + 0.05, z + len * 0.25], "hazard"),
      D("cylY", [r * 0.35, 0.25], [0, deck + r * 2 + 0.1, z], "dark"),
    ] };
  }
  if (id === "armoured") return { top: deck + 1.0, parts: [
    P("box", "body", null, 0, "box", [W * 0.88, 1.0, len], [0, deck + 0.5, z], "dark"),
    P("plateL", "panel", "left", 180 * hm, "box", [0.07, 0.7, len * 0.85], [-W * 0.45, deck + 0.5, z], "rust"),
    P("plateR", "panel", "right", 180 * hm, "box", [0.07, 0.7, len * 0.85], [W * 0.45, deck + 0.5, z], "rust"),
    P("plateB", "panel", "rear", 180 * hm, "box", [W * 0.8, 0.7, 0.07], [0, deck + 0.5, back + 0.03], "rust"),
  ] };
  // bus shell: two storeys of panels with window rows, a side door and the hazard band
  const parts = [
    P("lower", "body", null, 0, "rbox", [W * 0.98, 0.9, len], [0, deck + 0.45, z], "paint"),
    P("upper", "body", null, 0, "rbox", [W * 0.96, 0.8, len * 0.98], [0, deck + 1.3, z], "paint"),
    P("roof", "roof", "top", 300 * hm, "rbox", [W * 0.92, 0.1, len * 0.94], [0, deck + 1.73, z], "paint2"),
    P("glassF", "window", "front", 60, "box", [W * 0.88, 0.6, 0.05], [0, deck + 1.3, z - len / 2 - 0.02], "glass", { rot: [-0.15, 0, 0] }),
    P("door", "door", "right", 200 * hm, "box", [0.06, 1.4, 0.9], [W * 0.49, deck + 0.75, z - len / 2 + 0.8], "paint2"),
    D("box", [W * 0.99, 0.15, len * 1.0], [0, deck + 0.88, z], "hazard"),
  ];
  const n = Math.max(2, Math.floor(len / 1.9));
  for (let i = 0; i < n; i++) {
    const wz = z - len / 2 + 1.9 + (i * (len - 2.4)) / n;
    parts.push(P(`winL${i}`, "window", "left", 40, "box", [0.05, 0.55, 1.2], [-W * 0.485, deck + 1.32, wz], "glass"));
    parts.push(P(`winR${i}`, "window", "right", 40, "box", [0.05, 0.55, 1.2], [W * 0.485, deck + 1.32, wz], "glass"));
  }
  return { top: deck + 1.8, parts };
}