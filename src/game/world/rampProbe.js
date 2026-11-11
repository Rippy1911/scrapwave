// Ramp spot finder (test tool): ?rampprobe=16,18,26 lists clean spots for those RAMPS entries (data/places.js),
// nearest to the current one first, fitted the way places/ramps.js fits them.
import { RAMPS, PLACES } from "@/game/data/places";
import { spotFaults } from "@/game/world/rampCheck";

const SIZE = { kicker: [12, 7, 2.6], mound: [16, 10, 3.2], carrier: [14, 4.4, 3.4], bus: [11, 3, 3.0], dune: [22, 16, 4.2] };

// No place (town, tanker, scrapyard...) within its radius + 10 m of the run-up, deck or 60 m past the lip.
function clearOfPlaces(p) {
  for (let a = -p.len / 2 - 45; a <= p.len / 2 + 60; a += 5) {
    const x = p.x + p.dirX * a, z = p.z + p.dirZ * a;
    if (PLACES.some((q) => Math.hypot(q.x - x, q.z - z) < (q.r || 0) + 10)) return false;
  }
  return true;
}

function fit(T, p, type) {
  const [len, w, hh] = SIZE[type] || SIZE.kicker, fx = p.dirX, fz = p.dirZ, sx = -fz, sz = fx;
  const g = (a, b) => T.heightAt(p.x + fx * a + sx * b, p.z + fz * a + sz * b);
  const slope = Math.max(Math.abs(g(len / 2, 0) - g(-len / 2, 0)) / len, Math.abs(g(0, w / 2) - g(0, -w / 2)) / w);
  let minG = Infinity;
  for (let i = 0; i <= 6; i++) for (const k of [-0.5, 0, 0.5]) minG = Math.min(minG, g(-len / 2 + (len * i) / 6, k * w));
  const y = minG - 0.15, h = Math.max(g(-len / 2, 0), g(len / 2, 0)) + hh - 0.15 - y;
  return { ...p, len, w, y, h, slope };
}

function candidates(w, d) {
  const out = [];
  if (d.road) {
    const road = w.roads.roads.find((r) => r.id === d.road), s0 = d.s ?? d.t * road.length;
    for (let s = 30; s < road.length - 30; s += 10) for (const rev of [!!d.rev, !d.rev]) for (const off of [...new Set([d.off, -d.off, 0, 8, -8, 14, -14, 22, -22])]) {
      const q = w.roads.at(d.road, 0, s);
      if (q.bridge || q.deck) continue;
      const sign = rev ? -1 : 1;
      out.push({ x: q.x - q.dz * off, z: q.z + q.dx * off, dirX: q.dx * sign, dirZ: q.dz * sign, cost: Math.abs(s - s0) + (rev !== !!d.rev ? 25 : 0) + Math.abs(off - d.off), data: `t: ${(s / road.length).toFixed(2)}, off: ${off}${rev ? ", rev: true" : ""}` });
    }
  } else {
    for (let hd = 0; hd < 360; hd += 15) for (const dx of [0, 30, -30, 60, -60]) for (const dz of [0, 30, -30, 60, -60]) {
      const h = (hd * Math.PI) / 180;
      out.push({ x: d.x + dx, z: d.z + dz, dirX: Math.sin(h), dirZ: -Math.cos(h), cost: Math.hypot(dx, dz) + Math.abs(((hd - d.heading + 540) % 360) - 180) * 0.2, data: `x: ${d.x + dx}, z: ${d.z + dz}, heading: ${hd}` });
    }
  }
  return out;
}

export function rampProbe(w, i, at = null) {
  const d = at ? { x: at[0], z: at[1], heading: 0, type: RAMPS[i]?.type } : RAMPS[i]; // at: probe as an open ramp there
  if (!d) return [];
  const fitted = candidates(w, d).map((p) => fit(w.terrain, p, d.type)).filter((p) => p.slope <= 0.12 && clearOfPlaces(p)).sort((a, b) => a.cost - b.cost);
  // Clean with today's colliders first; else terrain only (scatter keeps out of a ramp lane by itself).
  const clean = fitted.filter((p) => !spotFaults(w, p, true).length);
  if (clean.length) return clean.slice(0, 3).map((p) => p.data);
  return fitted.filter((p) => !spotFaults(w, p, false).length).slice(0, 3).map((p) => `${p.data} (${spotFaults(w, p, true).join("; ")})`);
}

// list items: "16" (the entry as it is) or "18@456,481" (as an open ramp around that point).
export function rampProbeText(w, list) {
  return list.map((s) => {
    const [i, at] = String(s).split("@"), n = Number(i);
    return `\nprobe #${s} (${RAMPS[n]?.type}): ${rampProbe(w, n, at ? at.split(",").map(Number) : null).join(" | ") || "no clean spot"}`;
  }).join("");
}