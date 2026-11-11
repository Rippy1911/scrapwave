// Assemble a vehicle mesh from its part list. Parts stay separate objects so they can be shot off.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CHASSIS } from "@/game/data/vehicles";
import { weaponModel, ramModel } from "@/game/weapons/models";
import { toTex } from "@/game/render/textures";
import { dressVehicle } from "@/game/vehicles/dress";
import { shellFor } from "@/game/vehicles/shells";
import { fitShell } from "@/game/vehicles/shellFit";
import { tierTrim } from "@/game/workshop/tierLook";
import { mechWeaponModel, MECH_WEAPON_IDS } from "@/game/mech/weaponModels";

const geoCache = new Map();
function geoFor(spec) {
  const k = spec.shape + spec.size.join(",") + (spec.cone ? "c" : "") + (spec.to ? spec.to.join(",") + spec.pos.join(",") : "");
  if (geoCache.has(k)) return geoCache.get(k);
  let g;
  const [a, b, c] = spec.size;
  if (spec.shape === "rbox") g = new RoundedBoxGeometry(a, b, c, 2, Math.min(a, b, c) * 0.3);
  else if (spec.shape === "box") g = new THREE.BoxGeometry(a, b, c);
  else if (spec.shape === "wedge") {
    // Free-build wedge: a box whose top front edge drops to the bottom (a ramp rising towards +z).
    g = new THREE.BoxGeometry(a, b, c);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) if (P.getY(i) > 0 && P.getZ(i) < 0) P.setY(i, -b / 2);
    g.computeVertexNormals();
  }
  else if (spec.shape.startsWith("cyl")) {
    g = spec.cone ? new THREE.ConeGeometry(a, b, 8) : new THREE.CylinderGeometry(a, a, b, 14);
    if (spec.shape === "cylX") g.rotateZ(Math.PI / 2);
    if (spec.shape === "cylZ") g.rotateX(spec.cone ? -Math.PI / 2 : Math.PI / 2);
  } else if (spec.shape === "tube") {
    const A = new THREE.Vector3(...spec.pos), B = new THREE.Vector3(...spec.to);
    const d = B.clone().sub(A), L = d.length();
    g = new THREE.CylinderGeometry(a, a, L, 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate((B.x - A.x) / 2, (B.y - A.y) / 2, (B.z - A.z) / 2);
  }
  geoCache.set(k, g);
  return g;
}

function cage(size, mat) {
  const [w, h, d] = size, g = new THREE.Group(), r = 0.05;
  const tube = (A, B) => {
    const s = { shape: "tube", size: [r], pos: A, to: B };
    const m = new THREE.Mesh(geoFor(s), mat); m.position.set(...A); m.castShadow = true; g.add(m);
  };
  const y0 = -h / 2, y1 = h / 2;
  for (const x of [-w / 2, w / 2]) {
    tube([x, y0, -d / 2], [x * 0.9, y1, -d / 2 + 0.25]);
    tube([x, y0, d / 2], [x * 0.9, y1, d / 2 - 0.1]);
    tube([x * 0.9, y1, -d / 2 + 0.25], [x * 0.9, y1, d / 2 - 0.1]);
  }
  tube([-w * 0.45, y1, -d / 2 + 0.25], [w * 0.45, y1, -d / 2 + 0.25]);
  tube([-w * 0.45, y1, d / 2 - 0.1], [w * 0.45, y1, d / 2 - 0.1]);
  tube([-w * 0.45, y1, -d / 2 + 0.25], [w * 0.45, y1, d / 2 - 0.1]);
  return g;
}

function armourModel(tier, size, M) {
  const [w, h, d] = size, g = new THREE.Group();
  const thick = tier === "forged" ? 1.6 : tier === "plate" ? 1.2 : 1;
  const mat = tier === "forged" ? M.dark : tier === "plate" ? M.chrome : M.rust;
  if (tier === "scrap") {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w * (0.5 + i * 0.12), h * (0.7 + i * 0.1), d * (0.5 + i * 0.12)), i === 1 ? M.paint("#5e6b3a") : M.rust);
      p.position.set((i - 1) * w * 0.15, (i - 1) * h * 0.08, (i - 1) * d * 0.12); p.rotation.set(0.05 * i, 0, 0.08 * (i - 1)); g.add(p);
    }
  } else {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w * thick > w + 0.1 ? w + 0.06 : w * thick, h, d * thick > d + 0.1 ? d + 0.06 : d * thick), mat);
    p.material = tier === "plate" ? M.rust : M.dark; g.add(p);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const rv = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), M.chrome);
      const t = (i + 0.5) / n;
      rv.position.set(w > d ? (t - 0.5) * w : (w / 2 + 0.02) * Math.sign(size[0] + 1e-6), h > 0.2 ? h * 0.35 : h / 2 + 0.02, d >= w ? (t - 0.5) * d : (d / 2 + 0.03));
      g.add(rv);
    }
    // Tier II "Welded": hazard stripes along the weld. Tier III "War-forged": dark riveted steel with a glowing strip.
    const e = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h * (tier === "forged" ? 0.08 : 0.18), d + 0.02), tier === "forged" ? M.light : M.hazard);
    e.position.y = h * 0.42; g.add(e);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function buildVehicleMesh(chassisId, opts, M, T) {
  const C = CHASSIS[chassisId];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // Per-vehicle paint canvas: damage marks are drawn onto it.
  const dmgCanvas = T.paintCanvas(opts.paint || "#c7762e");
  const dmgTex = toTex(dmgCanvas);
  const paintMat = new THREE.MeshStandardMaterial({ map: dmgTex, bumpMap: T.rust, bumpScale: 0.4, roughness: 0.55, metalness: 0.3 });
  const matOf = (name) => name === "paint" ? paintMat : name === "paint2" ? M.paint(opts.paint2 || "#3a3734") : name === "plate" ? M.plate(opts.plate || "SW-01") : M[name] || M.dark;

  const parts = [];
  for (const spec of C.parts) {
    let obj;
    if (spec.shape === "cage") { obj = cage(spec.size, matOf(spec.mat)); obj.position.set(...spec.pos); }
    else { obj = new THREE.Mesh(geoFor(spec), matOf(spec.mat)); obj.position.set(...(spec.shape === "tube" ? spec.pos : spec.pos)); obj.castShadow = true; obj.receiveShadow = true; }
    if (spec.rot) obj.rotation.set(...spec.rot);
    if (spec.fid) obj.userData.fid = spec.fid; // free-build part: the mech rig moves it with its limb and mode
    body.add(obj);
    if (spec.kind === "deco" || spec.kind === "body") { if (spec.kind === "body") obj.userData.dentable = true; if (spec.kind === "body") parts.push({ id: spec.id, kind: "body", obj, spec, hp: 0, maxHp: 0, detached: false }); continue; }
    const half = spec.shape === "cage" ? spec.size.map((v) => v / 2) : spec.shape.startsWith("cyl") ? [spec.size[0], spec.size[0], spec.size[0]] : spec.size.map((v) => v / 2);
    if (spec.shape === "cylZ") half[2] = spec.size[1] / 2;
    parts.push({ id: spec.id, kind: spec.kind, zone: spec.zone, obj, spec, hp: spec.hp, maxHp: spec.hp, detached: false, center: new THREE.Vector3(...spec.pos), half: new THREE.Vector3(...half), cracked: false });
  }
  // Number plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.02), matOf("plate"));
  const rear = C.hit.center[2] + C.hit.half[2];
  plate.position.set(0, -0.05, rear - 0.05); body.add(plate);

  // Armour per zone
  const armour = {};
  for (const zone of ["front", "rear", "left", "right", "top"]) {
    const tier = opts.armour && opts.armour[zone];
    if (!tier) continue;
    const [size, pos] = C.armour[zone];
    const obj = armourModel(tier, size, M);
    obj.position.set(...pos); body.add(obj);
    parts.push({ id: "armour_" + zone, kind: "armour", zone, obj, tier, hp: opts.armourHp?.[zone] || 150, maxHp: opts.armourHp?.[zone] || 150, detached: false, center: new THREE.Vector3(...pos), half: new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2) });
  }
  // Ram blade
  if (opts.ram) {
    const front = C.hit.center[2] - C.hit.half[2];
    const w = C.hit.half[0] * 2;
    const obj = ramModel(M, w);
    obj.position.set(0, -0.15, front + 0.1); body.add(obj);
    tierTrim(obj, opts.ramTier, M, [w, 0.22, 0.2], 0.1);
    parts.push({ id: "ram", kind: "ram", zone: "front", obj, hp: 260, maxHp: 260, detached: false, center: obj.position.clone().add(new THREE.Vector3(0, 0, -0.3)), half: new THREE.Vector3(w / 2, 0.3, 0.35) });
  }

  // Wheels
  const wheels = C.wheels.map((wd) => {
    const pivot = new THREE.Group(); pivot.position.set(...wd.pos);
    const spin = new THREE.Group(); pivot.add(spin);
    const tyre = new THREE.Mesh(geoFor({ shape: "cylX", size: [wd.r, wd.w] }), M.rubber);
    const rim = new THREE.Mesh(geoFor({ shape: "cylX", size: [wd.r * 0.6, wd.w + 0.02] }), wd.drive ? M.dark : M.chrome);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(wd.w + 0.06, wd.r * 0.25, wd.r * 0.25), M.rust);
    tyre.castShadow = true; rim.castShadow = true;
    if (!wd.ghost) spin.add(tyre, rim, hub); // bikes: one wheel of each physics pair is drawn, on the centre line
    if (wd.center) spin.position.x = -wd.pos[0];
    body.add(pivot);
    const part = { id: wd.id, kind: "wheel", zone: wd.pos[0] < 0 ? "left" : "right", obj: pivot, hp: wd.hp, maxHp: wd.hp, detached: false, center: new THREE.Vector3(...wd.pos), half: new THREE.Vector3(wd.w / 2, wd.r, wd.r) };
    parts.push(part);
    return { def: wd, pivot, spin, part, rot: 0 };
  });

  // Weapon mounts
  const mounts = [];
  for (const hp of C.hardpoints) {
    const wid = opts.loadout && opts.loadout[hp.id];
    if (!wid) continue;
    const m = MECH_WEAPON_IDS.has(wid) ? mechWeaponModel(wid, M) : weaponModel(wid, M);
    m.root.position.set(...hp.pos); body.add(m.root);
    if (hp.rot) m.root.rotation.set(...hp.rot);
    if (hp.fid) m.root.userData.fid = hp.fid;
    tierTrim(m.root, opts.tiers && opts.tiers[hp.id], M, [0.72, 0.14, 0.72], 0.07);
    const part = { id: "w_" + hp.id, kind: "weapon", zone: "top", obj: m.root, hp: 160, maxHp: 160, detached: false, center: new THREE.Vector3(...hp.pos).add(new THREE.Vector3(0, 0.3, 0)), half: new THREE.Vector3(0.4, 0.35, 0.6) };
    parts.push(part);
    mounts.push({ hp, weaponId: wid, model: m, part });
  }

  // Turbo flames at the exhausts
  const flames = C.exhausts.map((e) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 8, 1, true), M.turbo);
    f.rotation.x = Math.PI / 2;
    f.position.set(e[0], e[1], e[2] + 0.6); f.visible = false;
    body.add(f);
    return f;
  });

  // Kenney body shell (when its model has loaded): the procedural body boxes hide, breakable parts are re-seated
  // onto the shell surface as welded plates and window guards, weapons get welded pedestals.
  let shell = null;
  const S = shellFor(chassisId);
  if (S) {
    try { shell = fitShell(S, { body, parts, mounts, M, opts, plate }); } catch (err) { console.warn("[shell] skipped", err?.message || err); shell = null; }
  }

  root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return dressVehicle({ root, body, parts, wheels, mounts, flames, paintMat, dmgCanvas, dmgTex, chassis: C, shell }, M);
}