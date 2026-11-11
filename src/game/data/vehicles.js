// Part lists and sockets per chassis. Local frame: +x right, +y up, -z forward. Origin = centre of mass.
// shape: rbox | box | cylX | cylY | cylZ (size [r, len]) | tube (pos -> to, size [r]).
const P = (id, kind, zone, hp, shape, size, pos, mat, extra = {}) => ({ id, kind, zone, hp, shape, size, pos, mat, ...extra });
const D = (shape, size, pos, mat, extra = {}) => ({ id: null, kind: "deco", shape, size, pos, mat, ...extra });

const W = (id, x, y, z, r, w, steer, drive) => ({ id, pos: [x, y, z], r, w, steer, drive, hp: 160 });

const jackalBody = (spikes) => [
  P("frame", "body", null, 0, "box", [1.25, 0.22, 3.0], [0, -0.15, 0], "dark"),
  D("box", [1.0, 0.1, 2.4], [0, -0.05, 0.1], "rust"),
  D("rbox", [0.55, 0.55, 0.5], [0, 0.18, 0.3], "rubber"),
  D("cylX", [0.24, 0.9], [0, 0.18, 1.0], "chrome"),
  P("hood", "hood", "front", 90, "rbox", [1.2, 0.32, 1.05], [0, 0.04, -1.25], "paint"),
  P("boot", "boot", "rear", 90, "rbox", [1.05, 0.42, 0.75], [0, 0.2, 1.2], "paint2"),
  P("doorL", "door", "left", 80, "rbox", [0.08, 0.34, 1.35], [-0.68, 0.02, -0.05], "paint"),
  P("doorR", "door", "right", 80, "rbox", [0.08, 0.34, 1.35], [0.68, 0.02, -0.05], "paint"),
  P("bumperF", "bumper", "front", 100, "box", [1.6, 0.16, 0.2], [0, -0.16, -1.86], "rust"),
  P("bumperR", "bumper", "rear", 80, "box", [1.4, 0.14, 0.18], [0, -0.12, 1.62], "rust"),
  P("glass", "window", "front", 40, "box", [0.95, 0.38, 0.04], [0, 0.42, -0.6], "glass", { rot: [-0.45, 0, 0] }),
  P("cage", "cage", "top", 150, "cage", [1.15, 0.85, 1.5], [0, 0.55, 0.1], "dark"),
  P("lightL", "light", "front", 20, "cylZ", [0.11, 0.12], [-0.42, 0.22, -1.8], "light"),
  P("lightR", "light", "front", 20, "cylZ", [0.11, 0.12], [0.42, 0.22, -1.8], "light"),
  P("spare", "spare", "rear", 60, "cylZ", [0.36, 0.22], [0, 0.55, 1.65], "rubber"),
  D("box", [0.25, 0.35, 0.18], [0.45, 0.2, 1.62], "hazard"),
  D("tube", [0.06], [-0.3, 0.3, 1.45], "chrome", { to: [-0.3, 0.6, 1.7] }),
  D("tube", [0.06], [0.3, 0.3, 1.45], "chrome", { to: [0.3, 0.6, 1.7] }),
  ...(spikes ? [
    D("cylZ", [0.06, 0.6], [-0.6, -0.15, -2.15], "bone", { cone: true }),
    D("cylZ", [0.06, 0.6], [0, -0.15, -2.15], "bone", { cone: true }),
    D("cylZ", [0.06, 0.6], [0.6, -0.15, -2.15], "bone", { cone: true }),
  ] : []),
];

export const CHASSIS = {
  jackal: {
    parts: jackalBody(false),
    wheels: [W("wFL", -0.88, -0.38, -1.3, 0.38, 0.3, true, false), W("wFR", 0.88, -0.38, -1.3, 0.38, 0.3, true, false),
      W("wRL", -0.95, -0.26, 1.15, 0.5, 0.45, false, true), W("wRR", 0.95, -0.26, 1.15, 0.5, 0.45, false, true)],
    susLen: 0.55,
    hardpoints: [{ id: "s1", size: "S", pos: [-0.35, 1.0, 0.25] }, { id: "s2", size: "S", pos: [0.35, 1.0, 0.25] }],
    armour: { front: [[1.5, 0.42, 0.1], [0, 0.0, -1.98]], rear: [[1.3, 0.4, 0.1], [0, 0.05, 1.75]],
      left: [[0.1, 0.4, 1.7], [-0.77, 0.0, 0]], right: [[0.1, 0.4, 1.7], [0.77, 0.0, 0]], top: [[1.1, 0.08, 1.2], [0, 1.0, 0.1]] },
    hit: { half: [0.95, 0.65, 1.95], center: [0, 0.15, 0] },
    spheres: [{ z: -0.85, y: 0, r: 0.95 }, { z: 0.85, y: 0, r: 0.95 }],
    exhausts: [[-0.3, 0.6, 1.72], [0.3, 0.6, 1.72]],
    engineSound: "rasp",
  },
  buggy: null, // filled below
  brawler: {
    parts: [
      P("chassis", "body", null, 0, "rbox", [1.9, 0.55, 4.6], [0, -0.02, 0], "paint"),
      P("cabin", "body", null, 0, "rbox", [1.62, 0.5, 1.9], [0, 0.48, 0.4], "paint"),
      P("roof", "roof", "top", 120, "rbox", [1.5, 0.08, 1.55], [0, 0.76, 0.42], "paint2"),
      P("hood", "hood", "front", 130, "rbox", [1.72, 0.12, 1.75], [0, 0.3, -1.35], "paint"),
      P("blower", "blower", "front", 80, "rbox", [0.5, 0.32, 0.6], [0, 0.5, -1.35], "chrome"),
      P("boot", "boot", "rear", 110, "rbox", [1.72, 0.1, 0.95], [0, 0.29, 1.8], "paint"),
      P("doorL", "door", "left", 110, "rbox", [0.08, 0.5, 1.25], [-0.98, 0.1, 0.25], "paint2"),
      P("doorR", "door", "right", 110, "rbox", [0.08, 0.5, 1.25], [0.98, 0.1, 0.25], "paint2"),
      P("glassF", "window", "front", 40, "box", [1.45, 0.45, 0.04], [0, 0.5, -0.62], "glass", { rot: [-0.55, 0, 0] }),
      P("glassL", "window", "left", 30, "box", [0.04, 0.32, 1.3], [-0.82, 0.52, 0.4], "glass"),
      P("glassR", "window", "right", 30, "box", [0.04, 0.32, 1.3], [0.82, 0.52, 0.4], "glass"),
      P("glassB", "window", "rear", 30, "box", [1.4, 0.36, 0.04], [0, 0.52, 1.38], "glass", { rot: [0.5, 0, 0] }),
      P("bumperF", "bumper", "front", 150, "box", [2.05, 0.34, 0.3], [0, -0.16, -2.42], "rust"),
      P("bumperR", "bumper", "rear", 100, "box", [1.95, 0.24, 0.2], [0, -0.12, 2.36], "rust"),
      P("lightL", "light", "front", 20, "cylZ", [0.12, 0.1], [-0.65, 0.12, -2.3], "light"),
      P("lightR", "light", "front", 20, "cylZ", [0.12, 0.1], [0.65, 0.12, -2.3], "light"),
      D("cylZ", [0.08, 1.6], [-1.02, -0.22, 0.9], "chrome"),
      D("cylZ", [0.08, 1.6], [1.02, -0.22, 0.9], "chrome"),
      D("box", [0.9, 0.18, 0.04], [0, -0.05, 2.47], "plate"),
      D("cylY", [0.07, 0.28], [-0.12, 0.72, -1.35], "chrome"),
      D("cylY", [0.07, 0.28], [0.12, 0.72, -1.35], "chrome"),
    ],
    wheels: [W("wFL", -0.9, -0.36, -1.5, 0.42, 0.34, true, false), W("wFR", 0.9, -0.36, -1.5, 0.42, 0.34, true, false),
      W("wRL", -0.93, -0.33, 1.45, 0.46, 0.42, false, true), W("wRR", 0.93, -0.33, 1.45, 0.46, 0.42, false, true)],
    susLen: 0.5,
    hardpoints: [{ id: "m1", size: "M", pos: [0, 0.88, 0.45] }, { id: "s1", size: "S", pos: [-0.68, 0.48, -1.95] }, { id: "s2", size: "S", pos: [0.68, 0.48, -1.95] }],
    armour: { front: [[1.9, 0.45, 0.1], [0, 0.05, -2.62]], rear: [[1.85, 0.4, 0.1], [0, 0.05, 2.5]],
      left: [[0.1, 0.45, 3.4], [-1.04, 0.0, 0]], right: [[0.1, 0.45, 3.4], [1.04, 0.0, 0]], top: [[1.4, 0.08, 1.4], [0, 0.82, 0.42]] },
    hit: { half: [1.05, 0.8, 2.55], center: [0, 0.2, 0] },
    spheres: [{ z: -1.5, y: 0, r: 1.0 }, { z: 0, y: 0.1, r: 1.0 }, { z: 1.5, y: 0, r: 1.0 }],
    exhausts: [[-1.02, -0.22, 1.72], [1.02, -0.22, 1.72]],
    engineSound: "burble",
  },
  mammoth: {
    parts: [
      P("lower", "body", null, 0, "rbox", [2.5, 1.2, 8.6], [0, 0.4, 0.3], "paint"),
      P("upper", "body", null, 0, "rbox", [2.44, 1.0, 8.4], [0, 1.5, 0.35], "paint"),
      P("roof", "roof", "top", 300, "rbox", [2.3, 0.12, 8.0], [0, 2.06, 0.35], "paint2"),
      P("hood", "hood", "front", 220, "rbox", [2.2, 0.85, 1.4], [0, 0.25, -4.55], "paint"),
      P("glassF", "window", "front", 60, "box", [2.2, 0.75, 0.05], [0, 1.55, -3.95], "glass", { rot: [-0.15, 0, 0] }),
      P("door", "door", "right", 200, "box", [0.06, 1.7, 1.0], [1.26, 0.9, -3.3], "paint2"),
      ...[-1.6, 0.2, 2.0, 3.8].flatMap((z, i) => [
        P(`winL${i}`, "window", "left", 40, "box", [0.05, 0.62, 1.5], [-1.24, 1.55, z], "glass"),
        P(`winR${i}`, "window", "right", 40, "box", [0.05, 0.62, 1.5], [1.24, 1.55, z], "glass"),
      ]),
      P("plateL", "panel", "left", 180, "box", [0.07, 0.7, 2.0], [-1.28, 1.5, -0.7], "rust"),
      P("plateR", "panel", "right", 180, "box", [0.07, 0.7, 2.0], [1.28, 1.5, 1.1], "rust"),
      P("catcher", "bumper", "front", 260, "box", [2.6, 0.55, 0.45], [0, -0.3, -5.35], "rust", { rot: [0.45, 0, 0] }),
      P("bumperR", "bumper", "rear", 160, "box", [2.5, 0.3, 0.25], [0, -0.1, 4.7], "dark"),
      P("lightL", "light", "front", 30, "cylZ", [0.15, 0.1], [-0.85, 0.45, -5.27], "light"),
      P("lightR", "light", "front", 30, "cylZ", [0.15, 0.1], [0.85, 0.45, -5.27], "light"),
      D("tube", [0.05], [-1.1, 2.15, -3.4], "dark", { to: [-1.1, 2.15, 4.2] }),
      D("tube", [0.05], [1.1, 2.15, -3.4], "dark", { to: [1.1, 2.15, 4.2] }),
      D("box", [2.46, 0.18, 8.45], [0, 0.95, 0.35], "hazard"),
      D("cylY", [0.12, 1.6], [1.15, 2.4, 4.3], "chrome"),
      D("box", [1.6, 0.6, 0.6], [0, 2.4, 3.6], "wood"),
      D("box", [1.0, 0.25, 0.04], [0, 0.05, 4.84], "plate"),
    ],
    wheels: [W("wFL", -1.12, -0.6, -3.5, 0.55, 0.45, true, false), W("wFR", 1.12, -0.6, -3.5, 0.55, 0.45, true, false),
      W("wML", -1.12, -0.6, 2.3, 0.55, 0.5, false, true), W("wMR", 1.12, -0.6, 2.3, 0.55, 0.5, false, true),
      W("wRL", -1.12, -0.6, 3.6, 0.55, 0.5, false, true), W("wRR", 1.12, -0.6, 3.6, 0.55, 0.5, false, true)],
    susLen: 0.6,
    hardpoints: [{ id: "l1", size: "L", pos: [0, 2.2, -1.6] }, { id: "l2", size: "L", pos: [0, 2.2, 2.4] },
      { id: "m1", size: "M", pos: [-0.75, 2.2, 0.4] }, { id: "m2", size: "M", pos: [0.75, 2.2, 0.4] },
      { id: "s1", size: "S", pos: [-0.95, 0.95, -5.0] }, { id: "s2", size: "S", pos: [0.95, 0.95, -5.0] }],
    armour: { front: [[2.4, 0.9, 0.12], [0, 0.4, -5.32]], rear: [[2.4, 1.6, 0.12], [0, 1.0, 4.68]],
      left: [[0.12, 1.0, 7.0], [-1.33, 0.5, 0.3]], right: [[0.12, 1.0, 7.0], [1.33, 0.5, 0.3]], top: [[2.2, 0.1, 6.5], [0, 2.16, 0.3]] },
    hit: { half: [1.35, 1.4, 5.3], center: [0, 0.75, -0.3] },
    spheres: [{ z: -4.0, y: 0.4, r: 1.35 }, { z: -1.5, y: 0.6, r: 1.4 }, { z: 1.0, y: 0.6, r: 1.4 }, { z: 3.5, y: 0.6, r: 1.4 }],
    exhausts: [[1.15, 3.2, 4.3]],
    engineSound: "diesel",
  },
  bulwark: {
    parts: [
      P("lower", "body", null, 0, "rbox", [2.35, 0.95, 6.2], [0, 0.32, 0.15], "paint"),
      P("hull", "body", null, 0, "rbox", [2.2, 0.75, 4.2], [0, 0.72, -0.35], "paint"),
      P("glacis", "hood", "front", 280, "rbox", [2.15, 0.42, 1.35], [0, 0.38, -2.65], "paint2"),
      P("turretBase", "body", null, 0, "rbox", [1.65, 0.35, 1.55], [0, 1.02, -0.2], "dark"),
      P("turret", "roof", "top", 240, "rbox", [1.55, 0.42, 1.45], [0, 1.28, -0.15], "paint"),
      P("gun", "body", null, 0, "rbox", [0.22, 0.22, 2.6], [0, 1.12, -1.45], "dark"),
      P("mantlet", "window", "front", 120, "box", [0.45, 0.35, 0.12], [0, 1.1, -0.55], "dark"),
      P("rear", "boot", "rear", 200, "rbox", [2.1, 0.35, 0.95], [0, 0.42, 2.75], "paint"),
      P("deck", "panel", "top", 180, "box", [1.9, 0.06, 3.8], [0, 0.76, 0.9], "rust"),
      P("lightL", "light", "front", 25, "cylZ", [0.12, 0.1], [-0.78, 0.38, -3.05], "light"),
      P("lightR", "light", "front", 25, "cylZ", [0.12, 0.1], [0.78, 0.38, -3.05], "light"),
      ...[-2.15, -0.65, 0.85, 2.35].flatMap((z, i) => [
        D("box", [0.42, 0.55, 1.35], [-1.38, -0.02, z], "dark", { tread: true, side: -1, seg: i }),
        D("box", [0.42, 0.55, 1.35], [1.38, -0.02, z], "dark", { tread: true, side: 1, seg: i }),
      ]),
      D("box", [2.3, 0.22, 0.08], [0, 0.22, -3.18], "plate"),
      D("cylY", [0.09, 0.4], [-0.5, 1.52, 0.6], "chrome"),
      D("cylY", [0.09, 0.4], [0.5, 1.52, 0.6], "chrome"),
      D("box", [0.55, 0.12, 0.7], [0.62, 1.18, 0.85], "paint2"),
    ],
    wheels: [
      ...[-2.15, -0.65, 0.85, 2.35, 3.05].flatMap((z, i) => [
        W(`wL${i}`, -1.28, -0.12, z, 0.42, 0.22, false, true),
        W(`wR${i}`, 1.28, -0.12, z, 0.42, 0.22, false, true),
      ]),
    ],
    susLen: 0.38,
    skidSteer: true,
    turretPitch: true,
    armourMul: { front: 1, left: 0.7, right: 0.7, rear: 0.5, top: 0.4 },
    hardpoints: [
      { id: "l1", size: "L", pos: [0, 1.05, -0.75], rot: [0, 0, 0], turret: true },
      { id: "s1", size: "S", pos: [0.42, 1.22, 0.15], rot: [0, 0, 0], coax: true, turret: true },
    ],
    armour: {
      front: [[2.2, 0.85, 0.1], [0, 0.45, -3.12]], rear: [[2.05, 0.55, 0.1], [0, 0.4, 2.9]],
      left: [[0.1, 0.55, 5.6], [-1.32, 0.35, 0.15]], right: [[0.1, 0.55, 5.6], [1.32, 0.35, 0.15]],
      top: [[1.5, 0.08, 1.35], [0, 1.38, -0.1]],
    },
    hit: { half: [1.32, 0.95, 3.25], center: [0, 0.55, 0.05] },
    spheres: [{ z: -2.6, y: 0.35, r: 1.25 }, { z: 0, y: 0.55, r: 1.3 }, { z: 2.4, y: 0.45, r: 1.25 }],
    exhausts: [[-0.55, 0.6, 2.85], [0.55, 0.6, 2.85]],
    engineSound: "diesel",
  },
  pickup: {
    parts: [
      P("chassis", "body", null, 0, "rbox", [1.95, 0.6, 4.8], [0, -0.0, 0], "paint"),
      P("cabin", "body", null, 0, "rbox", [1.8, 0.7, 1.5], [0, 0.6, -0.4], "paint"),
      P("roof", "roof", "top", 100, "rbox", [1.7, 0.08, 1.4], [0, 0.98, -0.4], "paint2"),
      P("hood", "hood", "front", 120, "rbox", [1.85, 0.12, 1.3], [0, 0.34, -1.75], "paint"),
      P("glassF", "window", "front", 30, "box", [1.6, 0.5, 0.04], [0, 0.65, -1.18], "glass", { rot: [-0.4, 0, 0] }),
      P("doorL", "door", "left", 100, "rbox", [0.08, 0.55, 1.2], [-1.0, 0.15, -0.4], "paint2"),
      P("doorR", "door", "right", 100, "rbox", [0.08, 0.55, 1.2], [1.0, 0.15, -0.4], "paint2"),
      P("bed", "boot", "rear", 120, "box", [1.8, 0.5, 0.06], [0, 0.5, 2.35], "rust"),
      P("bumperF", "bumper", "front", 140, "box", [2.1, 0.3, 0.28], [0, -0.15, -2.5], "rust"),
      P("lightL", "light", "front", 20, "cylZ", [0.11, 0.1], [-0.65, 0.15, -2.42], "light"),
      P("lightR", "light", "front", 20, "cylZ", [0.11, 0.1], [0.65, 0.15, -2.42], "light"),
      D("box", [0.06, 0.5, 2.2], [-0.92, 0.5, 1.25], "rust"),
      D("box", [0.06, 0.5, 2.2], [0.92, 0.5, 1.25], "rust"),
      ...[-0.7, 0, 0.7].map((x) => D("cylZ", [0.07, 0.7], [x, -0.15, -2.85], "bone", { cone: true })),
      D("tube", [0.06], [-0.85, 0.6, 0.4], "bone", { to: [-0.85, 1.5, 0.9] }),
      D("tube", [0.06], [0.85, 0.6, 0.4], "bone", { to: [0.85, 1.5, 0.9] }),
      D("tube", [0.06], [-0.85, 1.5, 0.9], "bone", { to: [0.85, 1.5, 0.9] }),
    ],
    wheels: [W("wFL", -0.92, -0.38, -1.55, 0.45, 0.36, true, false), W("wFR", 0.92, -0.38, -1.55, 0.45, 0.36, true, false),
      W("wRL", -0.92, -0.38, 1.5, 0.45, 0.36, false, true), W("wRR", 0.92, -0.38, 1.5, 0.45, 0.36, false, true)],
    susLen: 0.55,
    hardpoints: [{ id: "m1", size: "M", pos: [0, 1.0, 1.4] }, { id: "s1", size: "S", pos: [0, 1.1, -0.4] }],
    armour: { front: [[1.9, 0.45, 0.1], [0, 0.05, -2.65]], rear: [[1.9, 0.4, 0.1], [0, 0.1, 2.45]],
      left: [[0.1, 0.45, 3.6], [-1.05, 0, 0]], right: [[0.1, 0.45, 3.6], [1.05, 0, 0]], top: [[1.5, 0.08, 1.3], [0, 1.04, -0.4]] },
    hit: { half: [1.05, 0.85, 2.6], center: [0, 0.25, 0] },
    spheres: [{ z: -1.5, y: 0, r: 1.0 }, { z: 0, y: 0.1, r: 1.05 }, { z: 1.5, y: 0, r: 1.0 }],
    exhausts: [[0.75, -0.25, 2.45]],
    engineSound: "burble",
  },
  tanker: {
    parts: [
      P("frame", "body", null, 0, "box", [2.3, 0.4, 9.6], [0, -0.1, 0.3], "dark"),
      P("cab", "body", null, 0, "rbox", [2.4, 1.6, 2.2], [0, 0.8, -3.8], "paint"),
      P("tank", "body", null, 0, "cylZ", [1.15, 6.4], [0, 1.25, 1.4], "paint2"),
      P("hood", "hood", "front", 220, "rbox", [2.2, 0.8, 1.2], [0, 0.2, -5.4], "paint"),
      P("glassF", "window", "front", 50, "box", [2.1, 0.6, 0.05], [0, 1.25, -4.92], "glass", { rot: [-0.15, 0, 0] }),
      P("bumperF", "bumper", "front", 200, "box", [2.5, 0.4, 0.3], [0, -0.25, -6.05], "rust"),
      P("ladder", "panel", "rear", 120, "box", [0.5, 1.8, 0.08], [0.6, 1.0, 4.65], "dark"),
      D("box", [2.42, 0.25, 0.3], [0, 1.25, -0.6], "hazard"),
      D("box", [2.42, 0.25, 0.3], [0, 1.25, 3.4], "hazard"),
      D("cylY", [0.4, 0.3], [0, 2.45, 1.4], "dark"),
    ],
    wheels: [W("wFL", -1.12, -0.6, -4.3, 0.55, 0.45, true, false), W("wFR", 1.12, -0.6, -4.3, 0.55, 0.45, true, false),
      W("wML", -1.12, -0.6, 2.4, 0.55, 0.5, false, true), W("wMR", 1.12, -0.6, 2.4, 0.55, 0.5, false, true),
      W("wRL", -1.12, -0.6, 3.7, 0.55, 0.5, false, true), W("wRR", 1.12, -0.6, 3.7, 0.55, 0.5, false, true)],
    susLen: 0.6,
    hardpoints: [{ id: "m1", size: "M", pos: [0, 2.2, -3.6] }],
    armour: { front: [[2.4, 0.8, 0.12], [0, 0.3, -6.25]], rear: [[2.4, 1.6, 0.12], [0, 1.0, 4.75]],
      left: [[0.12, 1.0, 7], [-1.3, 0.5, 0.3]], right: [[0.12, 1.0, 7], [1.3, 0.5, 0.3]], top: [[2, 0.1, 5.5], [0, 2.45, 1.0]] },
    hit: { half: [1.3, 1.3, 5.6], center: [0, 0.8, -0.3] },
    spheres: [{ z: -4.4, y: 0.5, r: 1.3 }, { z: -1.8, y: 0.8, r: 1.3 }, { z: 0.9, y: 0.8, r: 1.3 }, { z: 3.6, y: 0.8, r: 1.3 }],
    exhausts: [[1.1, 2.2, -2.7]],
    engineSound: "diesel",
  },
};

CHASSIS.buggy = { ...CHASSIS.jackal, parts: jackalBody(true), engineSound: "rasp" };

// Motorbikes. Physics runs four ray-cast wheels in two narrow pairs (a single track would fall over); the left wheel of
// each pair is drawn on the centre line (center) and the right one is not drawn (ghost). The rider is plain body parts
// ("rider..." ids, never shot off) that bike.js hides when the rider is thrown. The sidecar rig has three real wheels.
const BW = (id, x, y, z, r, steer, drive, vis) => ({ ...W(id, x, y, z, r, 0.16, steer, drive), hp: 400, ...vis });
const rider = (y, z) => [
  P("riderLegs", "body", null, 0, "box", [0.36, 0.2, 0.5], [0, y, z], "dark"),
  P("riderTorso", "body", null, 0, "rbox", [0.38, 0.5, 0.26], [0, y + 0.36, z - 0.02], "paint2", { rot: [-0.35, 0, 0] }),
  P("riderHead", "body", null, 0, "rbox", [0.27, 0.27, 0.3], [0, y + 0.74, z - 0.12], "dark"),
  P("riderArmL", "body", null, 0, "box", [0.09, 0.09, 0.46], [-0.21, y + 0.42, z - 0.28], "paint2", { rot: [0.5, 0, 0] }),
  P("riderArmR", "body", null, 0, "box", [0.09, 0.09, 0.46], [0.21, y + 0.42, z - 0.28], "paint2", { rot: [0.5, 0, 0] }),
];
const bikeFrame = (len, fz, rz, bar, low) => [
  P("frame", "body", null, 0, "box", [0.16, 0.18, len * 0.62], [0, -0.02, 0], "dark"),
  P("tank", "hood", "front", 60, "rbox", [0.34, 0.22, 0.5], [0, low ? 0.16 : 0.24, -0.22], "paint"),
  P("seat", "boot", "rear", 50, "rbox", [0.28, 0.1, 0.6], [0, low ? 0.08 : 0.2, 0.32], "rubber"),
  P("fender", "bumper", "front", 40, "box", [0.2, 0.04, 0.42], [0, 0.12, fz], "paint"),
  P("fenderR", "bumper", "rear", 40, "box", [0.24, 0.05, 0.5], [0, 0.16, rz], "paint"),
  P("lightL", "light", "front", 15, "cylZ", [0.08, 0.08], [0, bar - 0.12, fz + 0.12], "light"),
  D("box", [0.26, 0.28, 0.42], [0, -0.06, 0.05], "chrome"),
  D("tube", [0.035], [-0.08, bar, fz + 0.2], "chrome", { to: [-0.08, -0.25, fz] }),
  D("tube", [0.035], [0.08, bar, fz + 0.2], "chrome", { to: [0.08, -0.25, fz] }),
  D("cylX", [0.025, 0.72], [0, bar, fz + 0.24], "chrome"),
  D("tube", [0.04], [0.16, -0.05, 0.1], "chrome", { to: [0.18, 0.12, rz + 0.1] }),
  D("box", [0.42, 0.04, 0.32], [0, 0.42, rz], "rust"),
];
// comDrop: round 15, bikes carry their weight 0.3 m lower than the usual rule (vehicles/physics.js initBody).
const bikeBase = (len, hit, susLen, extra) => ({
  susLen, hit, comDrop: 0.3, hardpoints: [{ id: "t1", size: "S", pos: [0, 0.44, len * 0.38] }],
  armour: { front: [[0.3, 0.2, 0.06], [0, 0.1, -len / 2]], rear: [[0.3, 0.2, 0.06], [0, 0.1, len / 2]], left: [[0.06, 0.2, 0.8], [-0.2, 0, 0]], right: [[0.06, 0.2, 0.8], [0.2, 0, 0]], top: [[0.3, 0.05, 0.4], [0, 0.4, 0.2]] },
  spheres: [{ z: -len / 4, y: 0, r: 0.4 }, { z: len / 4, y: 0, r: 0.4 }], exhausts: [[0.18, 0.12, len / 2 - 0.15]], engineSound: "rasp", bike: true, ...extra,
});
CHASSIS.dirtbike = bikeBase(2.1, { half: [0.32, 0.55, 1.05], center: [0, 0.2, 0] }, 0.42, {
  parts: [...bikeFrame(2.1, -0.72, 0.68, 0.62, false), ...rider(0.32, 0.12)],
  wheels: [BW("wFL", -0.22, -0.32, -0.72, 0.34, true, false, { center: true }), BW("wFR", 0.22, -0.32, -0.72, 0.34, true, false, { ghost: true }),
    BW("wRL", -0.22, -0.3, 0.68, 0.36, false, true, { center: true }), BW("wRR", 0.22, -0.3, 0.68, 0.36, false, true, { ghost: true })],
});
CHASSIS.chopper = bikeBase(2.6, { half: [0.36, 0.5, 1.3], center: [0, 0.15, 0] }, 0.4, {
  parts: [...bikeFrame(2.6, -1.05, 0.85, 0.85, true), ...rider(0.2, 0.25), D("cylZ", [0.05, 0.9], [-0.18, 0.0, 0.7], "chrome")],
  wheels: [BW("wFL", -0.24, -0.34, -1.05, 0.36, true, false, { center: true }), BW("wFR", 0.24, -0.34, -1.05, 0.36, true, false, { ghost: true }),
    BW("wRL", -0.24, -0.3, 0.85, 0.4, false, true, { center: true }), BW("wRR", 0.24, -0.3, 0.85, 0.4, false, true, { ghost: true })],
  engineSound: "burble",
});
CHASSIS.sidecar = bikeBase(2.5, { half: [0.75, 0.5, 1.25], center: [0.42, 0.15, 0] }, 0.4, {
  parts: [...bikeFrame(2.5, -0.95, 0.8, 0.8, true), ...rider(0.22, 0.22),
    P("tub", "body", null, 0, "rbox", [0.7, 0.45, 1.3], [0.95, 0.12, 0.15], "paint"),
    P("nose", "hood", "front", 80, "rbox", [0.6, 0.3, 0.4], [0.95, 0.12, -0.62], "paint2"),
    D("tube", [0.04], [0.1, -0.1, -0.3], "dark", { to: [0.7, -0.05, -0.3] }), D("tube", [0.04], [0.1, -0.1, 0.5], "dark", { to: [0.7, -0.05, 0.5] })],
  wheels: [W("wF", 0, -0.32, -0.95, 0.36, 0.16, true, false), W("wR", 0, -0.3, 0.8, 0.38, 0.16, false, true), W("wS", 1.02, -0.34, 0.25, 0.34, 0.16, false, false)].map((w) => ({ ...w, hp: 400 })),
  engineSound: "burble", lean: false,
});

export const LOADOUTS = {
  jackal: { s1: "mg", s2: "scatter" },
  brawler: { m1: "rockets", s1: "mg", s2: "mg", ram: true },
  mammoth: { l1: "autocannon", l2: null, m1: "harpoon", m2: null, s1: "mg", s2: "mg", ram: true },
  bulwark: { l1: "cannon", s1: "mg", ram: true },
  buggy: { s1: "mg", s2: "mg" },
  pickup: { m1: "rockets", s1: "mg", ram: true },
  tanker: { m1: "mg" },
  // bikes: the tail turret mount (its def is swapped for BIKE.turret by the workshop)
  dirtbike: { t1: "mg" }, chopper: { t1: "mg" }, sidecar: { t1: "mg" },
};

export const PAINTS = ["#c7762e", "#7d8a80", "#b23a1f", "#d9b23a", "#3f5f6e", "#5e6b3a", "#2c2a28", "#e3d6bd", "#8c3b55", "#2f7a74"];
export const RATTLER_PAINT = "#e6dfcc";
export const SIZE_ORDER = { S: 1, M: 2, L: 3 };