// Kenney body shell fitting: breakable parts are re-seated onto the shell surface as welded plates and window
// guards, lamps and the number plate move onto the nose and tail, and weapons get welded pedestals.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RATTLER_PAINT } from "@/game/data/vehicles";
import { shellMaterial } from "@/game/vehicles/shells";

const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const DOWN = new THREE.Vector3(0, -1, 0);
const SEAT = new Set(["hood", "boot", "roof", "door", "panel", "window"]);
const PLATE_T = 0.045;

// Where a part sits on the shell: probe from outside along its thinnest axis at its centre and four corners.
// Returns { p, n, ax } (surface point under the plate's highest corner, outward normal) or null to keep the spec pose.
function seatPose(S, spec, zone) {
  if (S.cache.has(spec.id)) return S.cache.get(spec.id);
  const size = spec.size, pos = new THREE.Vector3(...spec.pos);
  const ax = size[0] <= size[1] && size[0] <= size[2] ? 0 : size[1] <= size[2] ? 1 : 2;
  const zs = zone === "front" || zone === "left" ? -1 : zone === "rear" || zone === "right" ? 1 : 0;
  const sgn = ax === 1 ? 1 : (zs || Math.sign(pos.getComponent(ax)) || 1);
  const out = AX[ax].clone().multiplyScalar(sgn), back = out.clone().negate();
  const u = AX[(ax + 1) % 3], v = AX[(ax + 2) % 3], su = size[(ax + 1) % 3] * 0.42, sv = size[(ax + 2) % 3] * 0.42;
  const hits = [];
  for (const [a, b] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const o = pos.clone().addScaledVector(u, a * su).addScaledVector(v, b * sv).addScaledVector(out, 6);
    const h = S.probe(o, back, 12);
    if (a === 0 && b === 0 && !h) { S.cache.set(spec.id, null); return null; }
    if (h) hits.push(h);
  }
  const c = hits[0];
  const reach = size[ax] / 2 + (spec.kind === "window" ? 0.6 : 0.35);
  let res = null;
  if (Math.abs(c.p.getComponent(ax) - pos.getComponent(ax)) <= reach) {
    const n = new THREE.Vector3();
    for (const h of hits) if (Math.abs(h.p.distanceTo(c.p)) < Math.max(su, sv) * 3) n.add(h.n);
    n.normalize();
    if (n.dot(out) < 0.35) n.copy(out); // a corner fell off an edge: stay square to the car
    let off = 0;
    for (const h of hits) off = Math.max(off, h.p.clone().sub(c.p).dot(n));
    res = { p: c.p.clone().addScaledVector(n, Math.min(off, 0.25)), n, ax };
  }
  S.cache.set(spec.id, res);
  return res;
}

// Orientation with local axis `ax` along the surface normal and the other axes as close to the car's as possible.
const _m4 = new THREE.Matrix4();
function seatQuat(n, ax) {
  const a = n.clone();
  if (a.getComponent(ax) < 0) a.negate();
  const ri = ax === 1 ? 2 : 1, ref = AX[ri];
  const b = ref.clone().addScaledVector(a, -a.dot(ref)).normalize();
  const L = [];
  L[ax] = a; L[ri] = b;
  const t = 3 - ax - ri;
  L[t] = new THREE.Vector3().crossVectors(L[(t + 1) % 3], L[(t + 2) % 3]);
  return new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(L[0], L[1], L[2]));
}

// Flat-bar window guard: a frame, vertical bars and one rail, in the part's frame (thin along ax).
function guardGeo(size, ax) {
  const t = 0.035, bw = 0.04, along = ax === 0 ? 2 : 0;
  const W = size[along] * 0.96, H = size[1] * 0.96, pieces = [];
  const bar = (cx, cy, sw, sh) => {
    const s = [0, 0, 0]; s[ax] = t; s[along] = sw; s[1] = sh;
    const g = new THREE.BoxGeometry(...s), p = [0, 0, 0]; p[along] = cx; p[1] = cy;
    g.translate(...p); pieces.push(g);
  };
  bar(0, H / 2 - bw / 2, W, bw); bar(0, -H / 2 + bw / 2, W, bw); bar(-W / 2 + bw / 2, 0, bw, H); bar(W / 2 - bw / 2, 0, bw, H);
  const nb = Math.max(2, Math.round(W / 0.17));
  for (let i = 1; i < nb; i++) bar(-W / 2 + (i * W) / nb, 0, bw * 0.6, H);
  bar(0, 0, W, bw * 0.6);
  return mergeGeometries(pieces, false);
}

export function fitShell(S, { body, parts, mounts, M, opts, plate }) {
  const sm = shellMaterial(S, { paint: opts.paint || "#c7762e", rust: opts.paint === RATTLER_PAINT ? 0.65 : 0.42 });
  const mesh = new THREE.Mesh(S.geometry, sm.material);
  mesh.name = "shell"; mesh.castShadow = true; mesh.receiveShadow = true;
  body.add(mesh);
  const hide = new Set(S.cfg.hide || []);
  const partObjs = new Set(parts.map((p) => p.obj));
  for (const p of parts) if (p.kind === "body" && hide.has(p.id)) p.obj.visible = false;
  for (const name of S.cfg.dropDeco || []) for (const o of [...body.children]) if (o.isMesh && !partObjs.has(o) && o.material === M[name]) body.remove(o);
  let hoodTop = null;
  for (const p of parts) {
    const spec = p.spec;
    if (!spec || !SEAT.has(p.kind) || spec.shape === "cage") continue;
    const seat = seatPose(S, spec, p.zone);
    if (!seat) continue;
    const { p: at, n, ax } = seat;
    const dims = [...spec.size];
    if (p.kind === "window") {
      p.obj.geometry = guardGeo(dims, ax);
      p.obj.material = M.dark;
      dims[ax] = 0.035;
      p.obj.position.copy(at).addScaledVector(n, 0.03);
    } else {
      const k = p.kind === "roof" ? 0.8 : 0.93;
      for (let i = 0; i < 3; i++) dims[i] = i === ax ? PLATE_T : dims[i] * k;
      p.obj.geometry = new THREE.BoxGeometry(...dims);
      p.obj.position.copy(at).addScaledVector(n, PLATE_T / 2 + 0.008);
      if (p.kind === "hood") hoodTop = p.obj.position.y + PLATE_T / 2;
    }
    p.obj.quaternion.copy(seatQuat(n, ax));
    p.vis = { size: dims, seated: true };
  }
  // the blower sits on the hood plate; lamps sit on the nose and tail
  for (const p of parts) {
    if (p.kind === "blower" && hoodTop !== null) p.obj.position.y = hoodTop + p.spec.size[1] / 2 - 0.05;
    if (p.kind === "light") {
      const s = p.spec, dir = s.pos[2] < 0 ? 1 : -1;
      const h = S.probe(new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2] - dir * 4), new THREE.Vector3(0, 0, dir), 8);
      if (h && Math.abs(h.p.z - s.pos[2]) < 0.45) p.obj.position.z = h.p.z - dir * (s.size[1] / 2 - 0.02);
    }
  }
  // the number plate goes on the tail
  const ph = S.probe(new THREE.Vector3(plate.position.x, plate.position.y, plate.position.z + 4), new THREE.Vector3(0, 0, -1), 8);
  if (ph && ph.p.z < plate.position.z + 0.3) plate.position.z = ph.p.z + 0.015;
  // welded pedestals under the weapons (merged into each mount's ring, so no extra draw calls)
  for (const m of mounts) {
    const hp = m.hp.pos;
    const h = S.probe(new THREE.Vector3(hp[0], hp[1] + 0.02, hp[2]), DOWN, 2);
    const len = h ? hp[1] - h.p.y : 0;
    if (!h || len < 0.04 || len > 1.0) continue;
    const ring = m.model.root.children.find((o) => o.isMesh);
    if (!ring) continue;
    const ry = ring.position.y, pieces = [ring.geometry.index ? ring.geometry : ring.geometry];
    const post = new THREE.CylinderGeometry(0.075, 0.09, len, 8); post.translate(0, -len / 2 - ry, 0); pieces.push(post);
    const base = new THREE.BoxGeometry(0.46, 0.035, 0.46); base.translate(0, -len - ry + 0.0175, 0); pieces.push(base);
    for (let i = 0; i < 4; i++) {
      const gs = Math.min(0.2, len * 0.6), gu = new THREE.BoxGeometry(0.022, gs, gs * 0.9);
      gu.translate(0, -len - ry + gs / 2 + 0.03, 0.12); gu.rotateY((i * Math.PI) / 2); pieces.push(gu);
    }
    ring.geometry = mergeGeometries(pieces, false);
  }
  return { mesh, S, ...sm };
}