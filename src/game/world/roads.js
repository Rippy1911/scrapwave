// Road splines: sampling, smoothed height profiles, terrain flattening, ribbon meshes and queries.
import * as THREE from "three";
import { ROADS, RAMPS } from "@/game/data/places";

const STEP = 4;

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Spline samples { x, z, bridge, deck } every ~4 m along a ROADS entry (heights are filled in by buildRoads). */
export function sampleRoad(def) {
  const P = def.pts, out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], p0 = P[Math.max(0, i - 1)], p3 = P[Math.min(P.length - 1, i + 2)];
    const bridge = a[2] === "b";
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = bridge ? a[0] + (b[0] - a[0]) * t : cr(p0[0], a[0], b[0], p3[0], t);
      const z = bridge ? a[1] + (b[1] - a[1]) * t : cr(p0[1], a[1], b[1], p3[1], t);
      out.push({ x, z, y: 0, bridge, deck: bridge && k > 0 });
    }
  }
  const L = P[P.length - 1];
  out.push({ x: L[0], z: L[1], y: 0, bridge: false, deck: false });
  return out;
}

const ROAD_GRADE = 0.14; // steepest climb onto a bridge deck (about 8 degrees)
const ROAD_LANDING = 8; // metres held level with the deck before it, where the deck slab overhangs its end point

export function buildRoads(terrain, M) {
  const roads = [];
  for (const def of ROADS) {
    const s = sampleRoad(def);
    for (const p of s) p.y = terrain.heightAt(p.x, p.z);
    for (let pass = 0; pass < 4; pass++) {
      const ys = s.map((p) => p.y);
      for (let i = 0; i < s.length; i++) {
        if (s[i].deck) continue;
        let sum = 0, n = 0;
        for (let k = -6; k <= 6; k++) { const q = s[i + k]; if (q && !q.deck) { sum += ys[i + k]; n++; } }
        s[i].y = sum / n;
      }
    }
    // Straight decks across bridges.
    for (let i = 0; i < s.length; i++) {
      if (s[i].bridge && !s[i].deck) {
        let j = i + 1; while (j < s.length && s[j].deck) j++;
        const top = Math.max(s[i].y, s[j].y) + 0.3;
        for (let k = i; k <= j; k++) s[k].y = top;
        i = j;
      }
    }
    // Embankments: where a deck sits above the road at either end (the Highway Bridge's east end was 18 m up),
    // the road climbs to it at no more than ROAD_GRADE, and applyRoad raises the ground under it, so no deck
    // ends in a wall.
    {
      const dist = [0];
      for (let i = 1; i < s.length; i++) dist[i] = dist[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z);
      for (let i = 0; i < s.length; i++) {
        if (!s[i].bridge || s[i].deck) continue;
        let j = i + 1; while (j < s.length && s[j].deck) j++;
        const top = s[i].y;
        for (let k = i - 1; k >= 0; k--) { const y = top - ROAD_GRADE * Math.max(0, dist[i] - dist[k] - ROAD_LANDING); if (s[k].y >= y) break; s[k].y = y; }
        for (let k = j + 1; k < s.length; k++) { const y = top - ROAD_GRADE * Math.max(0, dist[k] - dist[j] - ROAD_LANDING); if (s[k].y >= y) break; s[k].y = y; }
        i = j;
      }
    }
    let len = 0;
    for (let i = 0; i < s.length; i++) {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      s[i].dx = dx / l; s[i].dz = dz / l;
      if (i > 0) len += Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z);
      s[i].s = len;
    }
    roads.push({ id: def.id, kind: def.kind, width: def.width, samples: s, length: len });
  }
  for (const r of roads) terrain.applyRoad(r.samples, r.width);

  // Ribbons
  const group = new THREE.Group();
  group.name = "roads";
  const matFor = { highway: M.asphalt, rail: M.railbed, dirt: M.dirt };
  for (const r of roads) {
    let run = [];
    const flush = () => {
      if (run.length > 1) group.add(ribbon(run, r.width, matFor[r.kind]));
      run = [];
    };
    for (const p of r.samples) {
      if (p.deck) { flush(); continue; }
      run.push(p);
      if (p.bridge) flush();
    }
    flush();
  }

  // Spatial grid for nearest-road queries.
  const CELL = 32, G = new Map();
  const key = (cx, cz) => cx * 1000 + cz;
  roads.forEach((r, ri) => r.samples.forEach((p, si) => {
    const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    if (!G.has(k)) G.set(k, []);
    G.get(k).push(ri, si);
  }));
  const res = { x: 0, y: 0, z: 0, dx: 0, dz: 1, dist: 0, road: null, i: 0 };
  function nearest(x, z, maxRing = 6, allowDeck = false) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = Infinity;
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let a = -ring; a <= ring; a++) for (let b = -ring; b <= ring; b++) {
        const list = G.get(key(cx + a, cz + b));
        if (!list) continue;
        for (let n = 0; n < list.length; n += 2) {
          const r = roads[list[n]], p = r.samples[list[n + 1]];
          if (!allowDeck && (p.deck || p.bridge)) continue;
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < best) { best = d; Object.assign(res, { x: p.x, y: p.y, z: p.z, dx: p.dx, dz: p.dz, road: r, i: list[n + 1] }); }
        }
      }
      if (best < Infinity) break;
    }
    res.dist = Math.sqrt(best);
    return res;
  }

  function at(roadId, t, metres) {
    const r = roads.find((q) => q.id === roadId);
    const target = metres ?? t * r.length;
    let i = 0; while (i < r.samples.length - 1 && r.samples[i].s < target) i++;
    return { ...r.samples[i], road: r, i };
  }

  // Ramp placements resolved against the sampled roads.
  const rampPlacements = RAMPS.map((d) => {
    if (d.road) {
      const p = at(d.road, d.t, d.s);
      const sign = d.rev ? -1 : 1;
      const place = (q) => ({ x: q.x + q.dz * d.off * -1, z: q.z + q.dx * d.off, dirX: q.dx * sign, dirZ: q.dz * sign });
      // Spare spots up to 60 m along the same road (same side and offset), nearest first, for a ramp whose own spot
      // is too steep (buildRamps picks the first flat one). Never on a bridge deck or the road's last metres.
      const alts = [];
      for (const a of [10, -10, 20, -20, 30, -30, 40, -40, 50, -50, 60, -60]) {
        const s = p.s + a;
        if (s < 20 || s > p.road.length - 20) continue;
        const q = at(d.road, 0, s);
        if (!q.bridge && !q.deck) alts.push(place(q));
      }
      return { ...place(p), type: d.type, first: !!d.first, alts };
    }
    const h = (d.heading * Math.PI) / 180;
    return { x: d.x, z: d.z, dirX: Math.sin(h), dirZ: -Math.cos(h), type: d.type };
  });

  return { roads, group, nearest, at, rampPlacements };
}

function ribbon(run, width, mat) {
  const n = run.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), nor = new Float32Array(n * 6);
  const idx = [];
  for (let i = 0; i < n; i++) {
    const p = run[i], px = -p.dz * width / 2, pz = p.dx * width / 2;
    pos.set([p.x - px, p.y + 0.06, p.z - pz, p.x + px, p.y + 0.06, p.z + pz], i * 6);
    nor.set([0, 1, 0, 0, 1, 0], i * 6);
    uv.set([0, p.s / (width * 1.4), 1, p.s / (width * 1.4)], i * 4);
    if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}