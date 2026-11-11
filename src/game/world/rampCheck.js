// Ramp run-up test: for every built ramp, the 45 m run-up behind the foot (no 5 m step over 1.5 m, nothing 8 m off
// the foot, no collider), the foot fitted to the slope (ground at most 0.9 m over the deck there) and the landing lane
// (no wall above the lip, no collider 10-60 m past it). Test hooks: scrapwake.rampCheck(), ?rampcheck=1.
const RUN = 45, LAND0 = 10, LAND1 = 60;

function laneBlocked(w, r, a0, a1, own) {
  for (let a = a0; a <= a1; a += 4) {
    const x = r.x + r.dirX * a, z = r.z + r.dirZ * a;
    let hit = null;
    w.colliders.collect(x, z, r.w / 2 + 1.5, (b) => {
      if (hit || b.dead || b.noCollide || b.tag === "ramp" || own(b)) return;
      if (b.y + b.hy < w.terrain.heightAt(b.x, b.z) + 0.4) return; // flush with the ground: drivable
      const dx = b.x - r.x, dz = b.z - r.z, s = dz * r.dirX - dx * r.dirZ, Lx = -r.dirZ, Lz = r.dirX;
      if (Math.abs(dx * r.dirX + dz * r.dirZ - a) > 2 + Math.max(b.hx, b.hz)) return; // collect() is a grid query: keep only boxes at this 4 m step
      const c = b.cos ?? 1, sn = b.sin ?? 0, across = b.hx * Math.abs(c * Lx - sn * Lz) + b.hz * Math.abs(sn * Lx + c * Lz);
      if (Math.abs(s) - across < r.w / 2 + 0.5) hit = `${b.tag || b.kind || "box"}[${b.hx.toFixed(1)}x${b.hz.toFixed(1)} top ${(b.y + b.hy - w.terrain.heightAt(b.x, b.z)).toFixed(1)} @${Math.round(b.x)},${Math.round(b.z)}]`;
    });
    if (hit) return `${hit} at ${Math.round(a)} m`;
  }
  return null;
}

/** Faults of one ramp spot r = { x, z, dirX, dirZ, len, w, y (deck base), h (deck height) }; [] when it is clean. */
export function spotFaults(w, r, colliders = true) {
  const T = w.terrain, h = (a) => T.heightAt(r.x + r.dirX * a, r.z + r.dirZ * a);
  const foot = -r.len / 2, lip = r.len / 2, lipY = r.y + r.h;
  const own = (b) => { const dx = b.x - r.x, dz = b.z - r.z, a = dx * r.dirX + dz * r.dirZ; return a > foot - 1 && a < lip + 9 && Math.hypot(dx, dz) < r.len; };
  const why = [];
  let prev = h(foot);
  for (let k = 5; k <= RUN; k += 5) {
    const y = h(foot - k);
    if (Math.abs(y - prev) > 1.5) { why.push(`run-up step ${(y - prev).toFixed(1)} m at ${k} m`); break; }
    if (Math.abs(y - h(foot)) > 8) { why.push(`run-up ${(y - h(foot)).toFixed(1)} m off the foot at ${k} m`); break; }
    prev = y;
  }
  const footGap = h(foot) - r.y;
  if (footGap > 0.9) why.push(`foot ${footGap.toFixed(2)} m under the ground`);
  // Landing: a rising slope is fine; a wall is a 5 m step of over 1.5 m up, or ground over the lip itself.
  for (let a = lip + LAND0, py = h(lip + LAND0 - 5); a <= lip + LAND1; a += 5) {
    const y = h(a);
    if (y - py > 1.5 || (a < lip + 25 && y > lipY)) { why.push(`landing wall ${(y - py).toFixed(1)} m at ${Math.round(a - lip)} m`); break; }
    py = y;
  }
  if (colliders) {
    // Collider lanes match the keep-out of places/ramps.js (45 m run-up, 40 m landing).
    const run = laneBlocked(w, r, foot - RUN + 2, foot - 1, own), land = laneBlocked(w, r, lip + LAND0, lip + 38, own);
    if (run) why.push("run-up blocked: " + run);
    if (land) why.push("landing blocked: " + land);
  }
  return why;
}

export function rampCheck(w) {
  return w.ramps.map((r, i) => {
    const why = spotFaults(w, r);
    return { i, type: r.type, x: Math.round(r.x), z: Math.round(r.z), ok: !why.length, why: why.join("; ") };
  });
}

// ?rampcheck=1: the failing ramps in a corner box.
export function rampCheckOverlay(w, extra = "") {
  const res = rampCheck(w), bad = res.filter((x) => !x.ok);
  const el = document.createElement("pre");
  el.id = "ramp-check";
  el.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:9999;max-width:60vw;white-space:pre-wrap;font:11px monospace;background:rgba(0,0,0,.85);color:#e6dfcc;padding:8px;border:1px solid #f2c230";
  el.textContent = `RAMP CHECK · ${res.length - bad.length}/${res.length} clean\n` + bad.map((x) => `#${x.i} ${x.type} (${x.x}, ${x.z}): ${x.why}`).join("\n") + extra;
  document.body.appendChild(el);
  return res;
}