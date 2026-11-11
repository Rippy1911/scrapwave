// Things that stand along a race world's road, written into the layout (B: maps/race/raceLayout.js).
const HALF_PI = Math.PI / 2;

/** A tunnel over every metre of a zone: walls outside the barriers, a roof, a strip light every 16 m. */
export function tunnel(B, zone, m = "concrete", lit = "lit:#ffb060") {
  let k = 0;
  B.zone(zone, 8, (p, side) => {
    for (const sd of [-1, 1]) { const [x, z] = side(sd * (p.w / 2 + 1.7)); B.solid(m, x, z, 1.2, 6.6, 9, p.r, p.y); }
    B.deco(m, p.x, p.z, p.w + 4.8, 1, 9, p.r, p.y + 6.6);
    if (k++ % 2 === 0) B.bit(lit, p.x, p.y + 6.45, p.z, 0.5, 0.16, 3, p.r);
  });
}

/** Pillars under a raised road, from `base` up to the slab. */
export function pillars(B, zone, every = 28, m = "concrete", base = 0) {
  B.zone(zone, every, (p) => { if (p.y - base > 3 && !p.gap) B.post(m, p.x, p.z, 1.1, p.y - 0.8 - base, base); });
}

/** An overpass across the road at p: a deck on two piers, `span` metres wide, with broken ends. */
export function overpass(B, p, side, m = "rust", span = 64) {
  B.deco("concrete", p.x, p.z, span, 1.6, 11, p.r, p.y + 7);
  B.deco(m, p.x, p.z, span, 1.1, 0.4, p.r, p.y + 8.6);
  for (const sd of [-1, 1]) {
    const [x, z] = side(sd * (p.w / 2 + 3.2));
    B.solid("concrete", x, z, 2.2, 7, 9, p.r, p.y);
    const [ex, ez] = side(sd * (span / 2 + 5));
    B.deco("concrete", ex, ez, 14, 1.6, 11, p.r, p.y + 4.2, { rz: sd * 0.45 }); // the fallen end
  }
}

/** A gas station beside the road at p (sd: -1 left, 1 right): a canopy on four posts, pumps, a shop, a lit sign. */
export function gasStation(B, p, side, sd, lit = "lit:#7dff6a") {
  const at = (d, f) => side(sd * (p.w / 2 + d), f), [cx, cz] = at(13, 0);
  B.deco("corrugated", cx, cz, 14, 0.6, 22, p.r, p.y + 5.4);
  for (const [d, f] of [[8, -9], [8, 9], [18, -9], [18, 9]]) { const [x, z] = at(d, f); B.post("dark", x, z, 0.3, 5.4, p.y); }
  for (const f of [-5, 0, 5]) { const [x, z] = at(13, f); B.solid("#b23a1f", x, z, 1, 1.7, 0.7, p.r, p.y); B.prop("barrel", ...at(15, f + 1.5), 0, p.y); }
  const [sx, sz] = at(30, 0);
  B.solid("concrete", sx, sz, 10, 4.2, 20, p.r, p.y);
  B.deco("rust", sx, sz, 11, 0.5, 21, p.r, p.y + 4.2);
  const [px, pz] = at(5, -16);
  B.post("dark", px, pz, 0.35, 11, p.y);
  B.bit(lit, px, p.y + 11.6, pz, 0.5, 2.4, 5, p.r + HALF_PI * 0);
}