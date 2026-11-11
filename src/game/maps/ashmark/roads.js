// The Ashmark's road network, laid out once (the same every visit) from roadNet.js and sites.js: every road becomes
// a line of samples ROAD_STEP apart with a height profile eased to its steepest allowed grade, bridges become level
// decks, and every site gets its ground height and facing. The result also becomes the ground's grading pass
// (grading.js through height.setGrade), so the land is cut and filled to the roads and pads before any tile is
// sampled. All in map coordinates; nothing here draws (engine/three/ashRoads.js) or builds (build/*.js).
//   road: { id, kind, name, w, loop, ds, length, worst (steepest grade), span, trim, pts }
//   pts:  [{ x, z, y, s, deck, gap, join, lip }]  join: inside a junction; lip: the deck's end a gap sample is drawn at
//   trim: [metres, metres] of the start and the end that lie under the surface of the road this one joins
//   span: { road, a, b, c (sample indices: first, last, nearest the middle), y, gap (metres open), mid (the middle
//           of the gap, metres along), lips: [the deck's two ends at the gap] }
//   site: sites.js entry plus { y, yaw } (and its spot on the road when it snaps to one)
import { mapHeight, setGrade } from "@/game/maps/ashmark/height";
import { ROAD_DEFS, ROAD_W, ROAD_STEP } from "@/game/maps/ashmark/roadNet";
import { SITES } from "@/game/maps/ashmark/sites";
import { smoothLine, roundCorners, resample, nearestOn, pointAt, levelNodes, blurProfile, easeProfile } from "@/game/maps/ashmark/roadLine";
import { makeGrade, MARGIN } from "@/game/maps/ashmark/grading";

const SEA_CLEAR = 1.3; // a road never dips below this: causeways through the Drownings
const DECK_OVER = 1.5; // a bridge sample this far above the ground is carried on a deck
let net = null;

function lay(def, roads, sites) {
  const C = def.pts.map((p) => p.slice()), loop = !!def.loop, joins = [];
  const join = (id, k, end) => { const R = roads.get(id), q = nearestOn(R.pts, R.loop, C[k][0], C[k][1]); C[k] = [q.x, q.z]; joins.push({ R, end }); };
  if (def.from) join(def.from, 0, 0);
  if (def.to) join(def.to, C.length - 1, 1);
  const site = def.site ? SITES.find((s) => s.id === def.site) : null;
  if (site) { // the last point: the edge of the site's pad
    const a = C[C.length - 1], k = site.r / (Math.hypot(site.x - a[0], site.z - a[1]) || 1);
    C.push([site.x + (a[0] - site.x) * k, site.z + (a[1] - site.z) * k]);
  }
  const { pts, ds } = resample(def.straight ? roundCorners(C) : smoothLine(C, loop), ROAD_STEP, loop);
  const n = pts.length, G = new Float64Array(n), Y = new Float64Array(n), pin = new Uint8Array(n), jn = new Uint8Array(n), trim = [0, 0];
  for (let i = 0; i < n; i++) { G[i] = mapHeight(pts[i][0], pts[i][1]); Y[i] = Math.max(G[i], SEA_CLEAR); }
  // As far as the road it joins shapes the ground (its bed and the 8 m the ground takes to ease out of it, and one
  // sample more), this road takes that road's height. trim is how far along this road that road's surface reaches.
  for (const j of joins) {
    const hw = j.R.w / 2, reach = hw + MARGIN + 8;
    for (let s = 0, past = 0, was = 0, out = false; s < n && !past; s++) {
      const i = j.end ? n - 1 - s : s, q = nearestOn(j.R.pts, j.R.loop, pts[i][0], pts[i][1]);
      if (s > 0 && q.d > reach) past = 1;
      if (!out && q.d > hw) { out = true; trim[j.end] = (s - 1 + (hw - was) / (q.d - was)) * ds; }
      was = q.d;
      Y[i] = q.y; pin[i] = jn[i] = 1;
    }
  }
  if (site && site.cut) { Y[n - 1] = mapHeight(site.x, site.z) - site.cut; pin[n - 1] = 1; }
  blurProfile(Y, 3, 2, pin, loop);

  let span = null;
  if (def.bridge) {
    const B = def.bridge, far = (i) => Math.hypot(pts[i][0] - B.at[0], pts[i][1] - B.at[1]);
    let c = 0, top = -Infinity;
    for (let i = 1; i < n; i++) if (far(i) < far(c)) c = i;
    const half = Math.round(B.len / 2 / ds), a = Math.max(0, c - half), b = Math.min(n - 1, c + half);
    for (let i = a; i <= b; i++) top = Math.max(top, G[i]);
    top += B.lift;
    for (let i = a; i <= b; i++) { Y[i] = top; pin[i] = 1; }
    // A gap (wider than one step) is centred between two samples, so each of its lips has a sample in the open air.
    span = { road: def.id, a, b, c, y: top, gap: B.gap || 0, mid: (c - (far(c - 1) < far(c + 1) ? 1 : 0) + 0.5) * ds, lips: null };
  }
  // Sharp corners are level (roadLine.levelNodes): the profile is eased by node and copied back.
  const { node, count } = levelNodes(pts, pin), Yn = new Float64Array(count), pn = new Uint8Array(count), cn = new Uint8Array(count);
  for (let i = 0; i < n; i++) { Yn[node[i]] += Y[i]; cn[node[i]]++; if (pin[i]) pn[node[i]] = 1; }
  for (let k = 0; k < count; k++) Yn[k] /= cn[k];
  const worst = easeProfile(Yn, ds, def.grade || 0.12, pn, loop);
  for (let i = 0; i < n; i++) Y[i] = Yn[node[i]];

  const P = pts.map((p, i) => ({
    x: p[0], z: p[1], y: Y[i], s: i * ds, join: !!jn[i],
    deck: !!span && i >= span.a && i <= span.b && Y[i] - G[i] > DECK_OVER,
    gap: !!span && span.gap > 0 && Math.abs(i * ds - span.mid) < span.gap / 2,
  }));
  if (span && span.gap) {
    span.lips = [pointAt(P, ds, span.mid - span.gap / 2), pointAt(P, ds, span.mid + span.gap / 2)];
    for (const p of P) if (p.gap) p.lip = span.lips[p.s < span.mid ? 0 : 1];
  }
  if (site) {
    const e = P[n - 1];
    sites.set(site.id, { ...site, y: e.y, yaw: site.yaw ?? Math.atan2(-(e.x - site.x), -(e.z - site.z)) });
  }
  return { id: def.id, kind: def.kind, name: def.name, w: ROAD_W[def.kind], loop, ds, length: ds * (loop ? n : n - 1), worst, span, trim, pts: P };
}

function build() {
  const roads = new Map(), sites = new Map();
  for (const def of ROAD_DEFS) roads.set(def.id, lay(def, roads, sites));
  for (const s of SITES) {
    if (s.snap) {
      const R = roads.get(s.snap), q = nearestOn(R.pts, R.loop, s.x, s.z);
      sites.set(s.id, { ...s, x: q.x, z: q.z, y: q.y, yaw: Math.atan2(-q.dx, -q.dz), at: q.i });
    } else if (!sites.has(s.id)) sites.set(s.id, { ...s, y: mapHeight(s.x, s.z), yaw: s.yaw || 0 });
  }
  const list = [...roads.values()];
  setGrade(makeGrade(list, [...sites.values()].filter((s) => s.r > 0)));
  net = { roads, list, sites, spans: list.filter((R) => R.span).map((R) => R.span) };
}

/** The network: { roads (Map by id), list, sites (Map by id), spans }. The first call lays it out (about 40 ms). */
export function layRoads() { if (!net) build(); return net; }
export const roadById = (id) => layRoads().roads.get(id) || null;
export const siteAt = (id) => layRoads().sites.get(id) || null;
/** One row per road for the hooks and the check: kind, length, steepest grade, bridge. */
export const roadStats = () => layRoads().list.map((R) => ({
  id: R.id, kind: R.kind, name: R.name, km: +(R.length / 1000).toFixed(2), samples: R.pts.length, maxGrade: +R.worst.toFixed(3),
  bridge: R.span ? { y: +R.span.y.toFixed(1), decks: R.pts.filter((p) => p.deck).length, gapM: R.span.gap } : null,
}));