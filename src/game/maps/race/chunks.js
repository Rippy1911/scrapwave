// The city of a race world, in chunks (160 m squares). Every chunk holds its buildings twice: near = one instanced
// mesh per building template with the detailed wall (casts shadows) plus the chunk's small bits (lamps, signs);
// far = a single instanced mesh for the whole chunk with a cheap material and no shadows. update() shows the near
// set within NEAR metres of the camera, the far set out to FAR, nothing beyond. Each building has a box collider.
import * as THREE from "three";
import { createKit } from "@/game/world/places/kit";
import { BLD, BLD_TINTS } from "@/game/maps/race/buildings";
import { createFacade } from "@/game/maps/race/facade";

const SIZE = 160, NEAR = 250, FAR = 1100;

export function buildChunks(game, parent, L, site, addCollider) {
  const facade = createFacade(L.facade), M = game.M, chunks = new Map(), mats = new Map();
  const tints = BLD_TINTS.map((c) => new THREE.Color(c).multiplyScalar(L.facade === "night" ? 0.45 : 1));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const chunk = (x, z) => {
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE), k = `${cx}:${cz}`;
    if (!chunks.has(k)) chunks.set(k, { x: site.x + (cx + 0.5) * SIZE, z: site.z + (cz + 0.5) * SIZE, blds: [], bits: [], near: new THREE.Group(), far: null });
    return chunks.get(k);
  };
  const litMat = (k) => {
    if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(k.slice(4)).multiplyScalar(5), toneMapped: false }));
    return mats.get(k);
  };
  const mat = (k) => (k.startsWith("lit:") ? litMat(k) : k[0] === "#" ? M.paint(k) : M[k] || M.rust);
  for (const b of L.blds) chunk(b.x, b.z).blds.push(b);
  for (const b of L.bits) chunk(b.x, b.z).bits.push(b);

  const place = (im, i, b) => {
    im.setMatrixAt(i, m4.compose(p.set(site.x + b.x, site.y + b.y, site.z + b.z), q.setFromEuler(e.set(0, b.r, 0)), one));
    im.setColorAt(i, tints[b.c % tints.length]);
  };
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  for (const c of chunks.values()) {
    for (const t of Object.keys(BLD)) {
      const list = c.blds.filter((b) => b.t === t);
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(facade.box(...BLD[t]), facade.near, list.length);
      list.forEach((b, i) => place(im, i, b));
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      c.near.add(im);
    }
    if (c.blds.length) {
      c.far = new THREE.InstancedMesh(unit, facade.far, c.blds.length);
      c.blds.forEach((b, i) => {
        c.far.setMatrixAt(i, m4.compose(p.set(site.x + b.x, site.y + b.y, site.z + b.z), q.setFromEuler(e.set(0, b.r, 0)), one.set(b.w, b.h, b.d)));
        c.far.setColorAt(i, tints[b.c % tints.length]);
        addCollider({ x: site.x + b.x, y: site.y + b.y + b.h / 2, z: site.z + b.z, hx: b.w / 2, hy: b.h / 2, hz: b.d / 2, yaw: b.r, tag: "arena" });
      });
      one.set(1, 1, 1);
      c.far.computeBoundingSphere();
      parent.add(c.far);
    }
    if (c.bits.length) {
      const kit = createKit(c.near, M, { add: () => null }, game.world.terrain), F = kit.frame(site.x, site.y, site.z, 0);
      for (const b of c.bits) F.box(mat(b.m), b.x, b.y, b.z, b.w, b.h, b.d, b.r);
      kit.finalize();
    }
    parent.add(c.near);
  }

  return {
    count: chunks.size,
    update(cam) {
      for (const c of chunks.values()) {
        const d = Math.hypot(cam.x - c.x, cam.z - c.z);
        c.near.visible = d < NEAR;
        if (c.far) c.far.visible = d >= NEAR && d < FAR;
      }
    },
    dispose() { facade.dispose(); unit.dispose(); for (const m of mats.values()) m.dispose(); },
  };
}