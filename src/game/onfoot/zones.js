// Safe zones: data and pure geometry. A zone is a circle on the ground (x, z, radius r).
// Towns, outposts and the player's base plot are safe zones; zoneSources.js maps the world's places onto these.
// Inside a zone nobody fires weapons, and only inside a zone can the driver get out and walk.

export const ZONE_RADIUS = {
  town: 70, // the Well-town and other towns
  outpost: 34, // fuel-station outposts
  plot: 60, // the player's own base plot (same as the plot ring)
};

export const ZONE_LABEL = { town: "Town", outpost: "Outpost", plot: "Your base" };

// Walkers stop this far inside the ring, so the character never stands on the line itself.
export const ZONE_EDGE = 1.2;
// A car counts as "in" a zone while its centre is inside the ring (no margin), for the weapons gate.
export const STOPPED_KMH = 4; // E gets out only below this speed

export function makeZone(id, kind, name, x, z, r = ZONE_RADIUS[kind] || 40) {
  return { id, kind, name: name || ZONE_LABEL[kind] || "Safe zone", x, z, r };
}

// The zone containing (x, z), the deepest one if several overlap; null when outside every zone.
export function zoneAt(zones, x, z, margin = 0) {
  let best = null, bestIn = -Infinity;
  for (const zn of zones) {
    const d = Math.hypot(x - zn.x, z - zn.z);
    const inside = zn.r - margin - d;
    if (inside >= 0 && inside > bestIn) { best = zn; bestIn = inside; }
  }
  return best;
}

export function inAnyZone(zones, x, z, margin = 0) {
  return !!zoneAt(zones, x, z, margin);
}

// Keeps a walker at least ZONE_EDGE inside `zone`. Mutates pos {x, z}; returns true when it was pushed back.
export function clampToZone(zone, pos, edge = ZONE_EDGE) {
  const dx = pos.x - zone.x, dz = pos.z - zone.z;
  const d = Math.hypot(dx, dz), max = zone.r - edge;
  if (d <= max || d < 1e-6) return false;
  pos.x = zone.x + (dx / d) * max;
  pos.z = zone.z + (dz / d) * max;
  return true;
}

// Metres from (x, z) to the zone's ring (negative = outside).
export function edgeDistance(zone, x, z) {
  return zone.r - Math.hypot(x - zone.x, z - zone.z);
}

// Points spread around a zone centre for parking free vehicles: `n` slots on a ring at `k` of the radius.
export function slotsAround(zone, n, k = 0.45, phase = 0.6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const rr = zone.r * k;
    out.push({ x: zone.x + Math.cos(a) * rr, z: zone.z + Math.sin(a) * rr, yaw: a + Math.PI / 2 });
  }
  return out;
}