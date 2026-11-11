// Piece meshes: one merged geometry per kind (one draw call per piece), plus the moving parts a few kinds need
// (gate door, turret head, core glow, lamp light). buildPiece(kind, material) also makes the build-view ghost.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { pieceDef } from "@/game/base/pieceCatalog";

const geos = new Map();
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const glowMat = new THREE.MeshBasicMaterial({ color: "#ff5a2a", toneMapped: false });
const lampMat = new THREE.MeshBasicMaterial({ color: "#ffe2a0", toneMapped: false });

function wedge(w, h, d) {
  const a = [-w / 2, 0, d / 2], b = [w / 2, 0, d / 2], c = [w / 2, 0, -d / 2], e = [-w / 2, 0, -d / 2], f = [w / 2, h, -d / 2], g = [-w / 2, h, -d / 2];
  const tris = [a, f, b, a, g, f, a, b, c, a, c, e, e, c, f, e, f, g, a, e, g, b, f, c];
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  const uv = []; for (let i = 0; i < tris.length; i += 3) uv.push(0, 0, 1, 1, 1, 0);
  g2.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g2.computeVertexNormals();
  return g2;
}

function bodyGeo(kind) {
  if (geos.has(kind)) return geos.get(kind);
  const [w, h, d] = pieceDef(kind).size;
  let g;
  switch (kind) {
    case "gate": g = mergeGeometries([box(0.9, h, d, -(w / 2 - 0.45), h / 2), box(0.9, h, d, w / 2 - 0.45, h / 2), box(w, 0.4, d, 0, h - 0.2)]); break;
    case "ramp": g = wedge(w, h, d); break;
    case "tower": g = mergeGeometries([box(w, h - 1, w, 0, (h - 1) / 2), box(w + 0.6, 0.3, w + 0.6, 0, h - 0.85), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => box(0.6, 0.9, 0.6, x * (w / 2), h - 0.25, z * (w / 2)))]); break;
    case "bridge": g = mergeGeometries([box(w, h, d, 0, h / 2), box(w, 0.6, 0.15, 0, h + 0.3, d / 2 - 0.1), box(w, 0.6, 0.15, 0, h + 0.3, -d / 2 + 0.1)]); break;
    case "barrels": g = mergeGeometries([-0.38, 0.38].flatMap((x) => [new THREE.CylinderGeometry(0.33, 0.33, h, 10).translate(x, h / 2, -0.3)]).concat([new THREE.CylinderGeometry(0.33, 0.33, h, 10).translate(0, h / 2, 0.35)])); break;
    case "sandbags": g = mergeGeometries([0, 1, 2].flatMap((r) => [-1, 0, 1].map((i) => box(0.95, 0.3, d * 0.9, i * 1 + (r % 2) * 0.2 - 0.1, 0.15 + r * 0.3)))); break;
    case "lamp": g = mergeGeometries([new THREE.CylinderGeometry(0.1, 0.16, h, 6).translate(0, h / 2, 0), box(0.7, 0.12, 0.3, 0.25, h - 0.1)]); break;
    case "turret": g = mergeGeometries([box(w, 1.2, w, 0, 0.6), new THREE.CylinderGeometry(0.7, 0.85, 0.3, 10).translate(0, 1.35, 0)]); break;
    case "core": g = mergeGeometries([box(w, h - 0.6, d, 0, (h - 0.6) / 2), box(w * 0.7, 0.6, d * 0.7, 0, h - 0.3)]); break;
    default: g = box(w, h, d, 0, h / 2);
  }
  geos.set(kind, g);
  return g;
}

export function buildPiece(kind, mat) {
  const root = new THREE.Group(), [w, h, d] = pieceDef(kind).size;
  const body = new THREE.Mesh(bodyGeo(kind), mat);
  body.castShadow = true; body.receiveShadow = true;
  root.add(body);
  const o = { root, body, parts: [body] };
  if (kind === "gate") {
    o.door = new THREE.Mesh(geos.get("gateDoor") || geos.set("gateDoor", box(w - 1.8, h - 0.4, d * 0.6, 0, (h - 0.4) / 2)).get("gateDoor"), mat);
    o.door.castShadow = true; root.add(o.door); o.parts.push(o.door);
  } else if (kind === "turret") {
    o.head = new THREE.Group(); o.head.position.y = 1.6; root.add(o.head);
    const hm = new THREE.Mesh(geos.get("turretHead") || geos.set("turretHead", mergeGeometries([box(1.2, 0.7, 1.4), box(0.16, 0.16, 1.6, -0.25, 0.05, -1.2), box(0.16, 0.16, 1.6, 0.25, 0.05, -1.2)])).get("turretHead"), mat);
    hm.castShadow = true; o.head.add(hm); o.parts.push(hm);
    o.muzzles = [new THREE.Vector3(-0.25, 1.65, -2), new THREE.Vector3(0.25, 1.65, -2)];
  } else if (kind === "core") {
    o.glow = new THREE.Mesh(box(w + 0.05, 0.35, d + 0.05, 0, h * 0.55), glowMat); root.add(o.glow);
  } else if (kind === "lamp") {
    o.glow = new THREE.Mesh(box(0.5, 0.06, 0.2, 0.3, h - 0.18), lampMat); root.add(o.glow);
  }
  return o;
}