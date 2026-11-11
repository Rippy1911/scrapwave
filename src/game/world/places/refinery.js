// The Burning Refinery: tanks, pipe racks, catwalks, two flare stacks and the Rattler fuel dump.
import * as THREE from "three";
import { addSmoke, addFire, addFlock } from "@/game/render/atmosphere";
import { dressProps } from "@/game/world/places/dressing";

export function buildRefinery(kit, place, props, roads) {
  const { M } = kit;
  const y0 = kit.terrain.heightAt(place.x, place.z);
  const F = kit.frame(place.x, y0, place.z, 0.3);
  const clear = (lx, lz, m) => { const [wx, wz] = F.toWorld(lx, lz); return roads.nearest(wx, wz, 3).dist > m; };

  const tanks = [[-30, -28, 8], [-8, -36, 6.5], [-34, 6, 7], [26, -30, 6]];
  for (const [x, z, r] of tanks) {
    if (!clear(x, z, r + 6)) continue;
    F.cyl(M.rust, x, 6, z, r, 12, { collide: true });
    F.cyl(M.paint("#e3d6bd"), x, 12.3, z, r + 0.2, 0.6);
    F.cyl(M.hazard, x, 2, z, r + 0.05, 0.8);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      F.box(M.dark, x + Math.cos(a) * (r + 0.6), 12.9, z + Math.sin(a) * (r + 0.6), 0.08, 1, 0.08);
    }
    F.beam(M.dark, [x + r + 0.3, 0, z], [x + r + 0.3, 12.5, z], 0.08);
  }

  // Pipe racks
  for (let i = 0; i < 6; i++) {
    const z = 18, x = -40 + i * 12;
    if (!clear(x, z, 6)) continue;
    for (const dz of [-2, 2]) { F.box(M.dark, x, 3.5, z + dz, 0.4, 7, 0.4); F.collider(x, 3.5, z + dz, 0.6, 7, 0.6); }
    F.box(M.dark, x, 7, z, 0.4, 0.4, 4.4);
  }
  for (const [y, dz, col] of [[6.4, -1.2, M.rust], [6.4, 0, M.chrome], [6.4, 1.2, M.paint("#b23a1f")], [7.4, -0.6, M.rust]]) {
    F.cyl(col, -10, y, 18 + dz, 0.35, 70, { rz: Math.PI / 2 });
  }
  // Catwalk
  F.box(M.dark, -20, 8, -12, 24, 0.15, 2);
  for (let x = -32; x <= -8; x += 4) { F.box(M.dark, x, 4, -12, 0.15, 8, 0.15); F.box(M.dark, x, 8.6, -11, 0.05, 1, 0.05); }

  // Flare stacks with live flames
  const flames = [];
  for (const [x, z] of [[10, -6], [18, 4]]) {
    F.cyl(M.dark, x, 15, z, 0.9, 30, { collide: true });
    F.cyl(M.hazard, x, 28, z, 0.95, 1.2);
    F.cyl(M.rust, x, 30.5, z, 1.2, 1);
    for (const a of [0, 2.1, 4.2]) F.beam(M.dark, [x + Math.cos(a) * 6, 0, z + Math.sin(a) * 6], [x, 20, z], 0.12);
    const [wx, wz] = F.toWorld(x, z);
    const g = new THREE.Group();
    g.position.set(wx, y0 + 31, wz);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 10, 1, true), M.fire);
    outer.position.y = 3;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.5, 8, 1, true), M.lamp);
    inner.position.y = 1.8;
    g.add(outer, inner);
    kit.scene.add(g);
    const light = new THREE.PointLight("#ff8a3a", 220, 70, 1.6);
    light.position.set(wx, y0 + 34, wz);
    kit.scene.add(light);
    flames.push({ g, outer, light, x: wx, z: wz, y: y0 + 34, t: Math.random() * 10 });
    addSmoke(kit.scene, wx, y0 + 36.5, wz, { kind: "black", rate: 7, size: 3.2, rise: 4 });
  }
  kit.updaters.push((dt) => {
    for (const f of flames) {
      f.t += dt;
      const k = 1 + Math.sin(f.t * 13) * 0.08 + Math.sin(f.t * 31) * 0.05;
      f.g.scale.set(k, 1 + Math.sin(f.t * 9) * 0.15, k);
      f.g.rotation.z = Math.sin(f.t * 1.3) * 0.12;
      f.light.intensity = 200 + Math.sin(f.t * 17) * 40;
    }
  });

  // Rattler fuel dump: red barrels that chain-explode
  const dump = [28, 24];
  F.box(M.concrete, dump[0], 0.1, dump[1], 14, 0.2, 10);
  F.box(M.sign("DANGER · FUEL", null, "#b23a1f", "#f2e6c8", 512, 128), dump[0], 3, dump[1] - 5.5, 6, 1.5, 0.1);
  F.box(M.dark, dump[0] - 3, 1.2, dump[1] - 5.5, 0.15, 2.4, 0.15);
  F.box(M.dark, dump[0] + 3, 1.2, dump[1] - 5.5, 0.15, 2.4, 0.15);
  const barrels = [];
  for (let i = 0; i < 18; i++) {
    const lx = dump[0] - 5 + (i % 6) * 2, lz = dump[1] - 2 + Math.floor(i / 6) * 2;
    const [wx, wz] = F.toWorld(lx, lz);
    barrels.push(props.add("barrel", wx, y0 + 0.2, wz));
    if (i % 4 === 0) barrels.push(props.add("barrel", wx, y0 + 1.45, wz));
  }
  const [dx, dz] = F.toWorld(dump[0], dump[1]);
  // burning oil pools and a gutted tank: visual fires with smoke (no gameplay effect)
  for (const [lx, lz, s] of [[-18, -10, 1.6], [-30, 20, 1.2], [5, 30, 1.0], [-44, -6, 1.3]]) {
    if (!clear(lx, lz, 6)) continue;
    const [wx, wz] = F.toWorld(lx, lz);
    addFire(kit.scene, wx, kit.terrain.heightAt(wx, wz) + 0.05, wz, s);
    addSmoke(kit.scene, wx, kit.terrain.heightAt(wx, wz) + 1.5, wz, { kind: "black", rate: 4, size: 2.2 * s, rise: 2.8 });
  }
  addFlock(kit.scene, place.x, y0 + 58, place.z, 7, 46);
  const items = [];
  let k = 0;
  for (const [x, z, r] of tanks) {
    if (!clear(x, z, r + 6)) continue;
    for (let i = 0; i < 4; i++) {
      const a = 0.7 + i * 0.35 + k, [wx, wz] = F.toWorld(x + Math.cos(a) * (r + 0.7), z + Math.sin(a) * (r + 0.7));
      items.push({ model: i % 3 === 2 ? "propane_tank" : i % 2 ? "barrel_fuel" : "barrel_oil_red", x: wx, z: wz, ry: a * 3 });
    }
    k += 1.7;
  }
  dressProps(kit, items);
  kit.label(place.name, place.x, y0 + 40, place.z);
  return { dump: { x: dx, z: dz, barrels }, flames };
}