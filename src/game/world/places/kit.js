// Building kit: batches primitives per material into merged meshes, adds colliders, labels and animated bits.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
const CONE = new THREE.ConeGeometry(1, 1, 8, 1);
const SPH = new THREE.IcosahedronGeometry(1, 1);
const TILE = 2; // metres per texture repeat on world structures
for (const g of [CYL, CYL6, CONE, SPH]) if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);

export function createKit(scene, M, colliders, terrain) {
  const buckets = new Map();
  const updaters = [];
  const labels = [];
  const m4 = new THREE.Matrix4(), lm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), v = new THREE.Vector3();

  // World-scale UVs: box-project each primitive in its own (scaled) frame so corrugation, rust and paint
  // keep a real-world size (TILE metres per texture repeat) instead of stretching one tile over a whole wall.
  function scaleUV(g, sc) {
    const P = g.attributes.position, N = g.attributes.normal, uv = g.attributes.uv;
    if (!P || !N || !uv) return;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) * sc.x, y = P.getY(i) * sc.y, z = P.getZ(i) * sc.z;
      const nx = Math.abs(N.getX(i) / sc.x), ny = Math.abs(N.getY(i) / sc.y), nz = Math.abs(N.getZ(i) / sc.z);
      if (nx >= ny && nx >= nz) uv.setXY(i, z / TILE, y / TILE);
      else if (ny >= nz) uv.setXY(i, x / TILE, z / TILE);
      else uv.setXY(i, x / TILE, y / TILE);
    }
    uv.needsUpdate = true;
  }

  function put(geo, mat, matrix, sc) {
    const g = geo.clone();
    if (sc && !mat.userData.keepUV) scaleUV(g, sc);
    g.applyMatrix4(matrix);
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(g);
  }

  function frame(x, y, z, yaw = 0) {
    const fm = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const F = {
      x, y, z, yaw, matrix: fm,
      toWorld(lx, lz) { return [x + lx * c + lz * sn, z - lx * sn + lz * c]; },
      groundY(lx, lz) { const [wx, wz] = F.toWorld(lx, lz); return terrain.heightAt(wx, wz) - y; },
      prim(geo, mat, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
        e.set(rx, ry, rz); q.setFromEuler(e);
        lm.compose(p.set(lx, ly, lz), q, s.set(sx, sy, sz));
        m4.multiplyMatrices(fm, lm);
        put(geo, mat, m4, s);
      },
      box(mat, lx, ly, lz, w, h, d, ry = 0, o = {}) {
        F.prim(BOX, mat, lx, ly, lz, w, h, d, o.rx || 0, ry, o.rz || 0);
        if (o.collide) {
          const [wx, wz] = F.toWorld(lx, lz);
          return colliders.add({ x: wx, y: y + ly, z: wz, hx: w / 2, hy: h / 2, hz: d / 2, yaw: yaw + ry, tag: o.tag, noRay: o.noRay });
        }
        return null;
      },
      cyl(mat, lx, ly, lz, r, h, o = {}) {
        F.prim(o.six ? CYL6 : CYL, mat, lx, ly, lz, r, h, o.r2 ? r : r, o.rx || 0, o.ry || 0, o.rz || 0);
        if (o.collide) {
          const [wx, wz] = F.toWorld(lx, lz);
          const horiz = o.rx || o.rz;
          colliders.add({ x: wx, y: y + ly, z: wz, hx: horiz && o.rz ? h / 2 : r, hy: horiz ? r : h / 2, hz: horiz && o.rx ? h / 2 : r, yaw: yaw + (o.ry || 0), tag: o.tag });
        }
      },
      cone(mat, lx, ly, lz, r, h, o = {}) { F.prim(CONE, mat, lx, ly, lz, r, h, r, o.rx || 0, o.ry || 0, o.rz || 0); },
      ball(mat, lx, ly, lz, r, o = {}) { F.prim(SPH, mat, lx, ly, lz, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1)); },
      // A beam between two local points.
      beam(mat, a, b, r = 0.08) {
        v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const len = v.length();
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
        lm.compose(p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, s.set(r, len, r));
        m4.multiplyMatrices(fm, lm);
        put(CYL6, mat, m4, s);
      },
      wedge(lx, lz, w, len, h, ry, o = {}) {
        const [wx, wz] = F.toWorld(lx, lz);
        const by = o.baseY ?? terrain.heightAt(wx, wz);
        return colliders.add({ x: wx, y: by + h / 2, z: wz, hx: w / 2, hy: h / 2, hz: len / 2, yaw: yaw + ry, kind: "wedge", curve: o.curve || 1.4, tag: "ramp" });
      },
      collider(lx, ly, lz, w, h, d, ry = 0, o = {}) {
        const [wx, wz] = F.toWorld(lx, lz);
        return colliders.add({ x: wx, y: y + ly, z: wz, hx: w / 2, hy: h / 2, hz: d / 2, yaw: yaw + ry, ...o });
      },
      mesh(obj, lx, ly, lz, ry = 0) {
        const [wx, wz] = F.toWorld(lx, lz);
        obj.position.set(wx, y + ly, wz); obj.rotation.y = yaw + ry;
        scene.add(obj);
        return obj;
      },
    };
    return F;
  }

  function label(text, x, y, z, color = "#f2c230") {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96;
    const ctx = c.getContext("2d");
    ctx.font = 'bold 54px "Black Ops One", Impact, sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 10; ctx.strokeStyle = "rgba(20,14,8,0.85)"; ctx.strokeText(text.toUpperCase(), 256, 50);
    ctx.fillStyle = color; ctx.fillText(text.toUpperCase(), 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true, fog: false, sizeAttenuation: false }));
    sp.scale.set(0.16, 0.03, 1);
    sp.position.set(x, y, z);
    sp.renderOrder = 10;
    scene.add(sp);
    labels.push(sp);
    return sp;
  }

  function finalize() {
    const out = [];
    for (const [mat, geos] of buckets) {
      for (let i = 0; i < geos.length; i += 400) {
        const merged = mergeGeometries(geos.slice(i, i + 400), false);
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = !mat.isMeshBasicMaterial;
        mesh.receiveShadow = true;
        scene.add(mesh);
        out.push(mesh);
      }
      geos.forEach((g) => g.dispose());
    }
    buckets.clear();
    return out;
  }

  return { frame, label, finalize, updaters, labels, M, colliders, terrain, scene, geo: { BOX, CYL, CYL6, CONE, SPH } };
}