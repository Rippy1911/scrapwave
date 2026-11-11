// Wing and tail-fin meshes for a car (round 13). One object per wing so it can be shot or ripped off like any part.
import * as THREE from "three";
import { wingSpec } from "@/game/workshop/wings";

const THICK = 0.09;

// A flat tapered, swept panel in the XZ plane: root at x = 0, tip at x = dir * span. Nose is -z.
function panelGeo(span, chord, sweep, dir) {
  const tipChord = chord * 0.55, back = span * sweep;
  const pts = [
    [0, -chord / 2], [0, chord / 2], // root: leading, trailing
    [dir * span, -tipChord / 2 + back], [dir * span, tipChord / 2 + back], // tip
  ];
  const v = [];
  for (const y of [THICK / 2, -THICK / 2]) for (const [x, z] of pts) v.push(x, y, z);
  const idx = [0, 1, 2, 2, 1, 3, 4, 6, 5, 6, 7, 5, 0, 2, 4, 4, 2, 6, 1, 5, 3, 3, 5, 7, 2, 3, 6, 6, 3, 7, 0, 4, 1, 1, 4, 5];
  if (dir < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed(); // hard edges
  flat.computeVertexNormals();
  return flat;
}

const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };

// Tier trim: a bright strip along the leading edge (II: brass, III: red-hot).
function trim(obj, tier, span, dir, M) {
  if (tier < 2) return;
  const strip = mesh(new THREE.BoxGeometry(span * 0.9, THICK + 0.02, 0.06), tier === 3 ? M.hazard || M.dark : M.brass || M.steel || M.dark);
  strip.position.set(dir * span * 0.47, 0, -0.32);
  obj.add(strip);
}

// One wing for a side. C: the chassis spec (hit box). Returns { obj, center, half } in body space.
export function buildWing(w, C, M, paintMat) {
  const s = wingSpec(w.id, w.tier), h = C.hit.half, c = C.hit.center;
  const skin = paintMat || M.steel || M.dark, frame = M.steel || M.dark;
  const obj = new THREE.Group();
  let center, half;
  if (s.fin) {
    // Vertical fin on the rear of the roof.
    const fin = mesh(panelGeo(s.span, s.chord, s.sweep, 1), skin);
    fin.rotation.z = Math.PI / 2; // span runs up
    obj.add(fin);
    obj.position.set(0, c[1] + h[1], c[2] + h[2] - s.chord * 0.6);
    center = new THREE.Vector3(0, obj.position.y + s.span / 2, obj.position.z + s.span * s.sweep * 0.5);
    half = new THREE.Vector3(0.12, s.span / 2, s.chord / 2);
  } else if (w.side === "roof") {
    // One wing across the roof on two struts: half the span each way.
    const sp = s.span * 0.75;
    for (const dir of [-1, 1]) { const p = mesh(panelGeo(sp, s.chord, s.sweep, dir), skin); obj.add(p); trim(p, s.tier, sp, dir, M); }
    for (const x of [-h[0] * 0.5, h[0] * 0.5]) { const st = mesh(new THREE.BoxGeometry(0.07, 0.34, 0.3), frame); st.position.set(x, -0.2, 0); obj.add(st); }
    obj.position.set(0, c[1] + h[1] + 0.36, c[2] + h[2] * 0.15);
    center = obj.position.clone();
    half = new THREE.Vector3(sp, 0.12, s.chord / 2);
  } else {
    const dir = w.side === "left" ? -1 : 1;
    const p = mesh(panelGeo(s.span, s.chord, s.sweep, dir), skin);
    obj.add(p); trim(p, s.tier, s.span, dir, M);
    const root = mesh(new THREE.BoxGeometry(0.16, 0.18, s.chord * 0.8), frame); // root bracket on the body side
    root.position.x = dir * 0.04; obj.add(root);
    obj.position.set(c[0] + dir * h[0], c[1] + h[1] * 0.25, c[2] + h[2] * 0.1);
    obj.rotation.z = dir * 0.06; // a little dihedral
    center = new THREE.Vector3(obj.position.x + dir * s.span / 2, obj.position.y, obj.position.z + s.span * s.sweep * 0.5);
    half = new THREE.Vector3(s.span / 2, 0.15, s.chord / 2);
  }
  return { obj, center, half, spec: s };
}