// ?bigcheck=1 (game/round15.js): enters the Ashmark, visits the five biome spots and then the four garages and the
// toll gate. At each one it waits for the streamer to settle plus 2 s and takes one row. Spots report the streaming
// and frame numbers plus the roads, places, scatter and weather in view. Outposts report the safe ring under the
// car, the no-guns rule inside and just outside it, the trader and garage landmarks, and how far a garage mended a
// car that arrived at half hull. window.scrapwake.big.check() reads the report; ui/BigCheckCard.jsx shows it.
import { BIOMES } from "@/game/maps/ashmark/layout";
import { heightAt } from "@/game/maps/ashmark/height";
import { OUTPOSTS } from "@/game/maps/ashmark/sites";

const SPOTS = ["waste", ...BIOMES.filter((b) => b !== "waste")];
const VISITS = [...SPOTS.map((id) => ({ id, name: id })), ...OUTPOSTS.map((s) => ({ id: s.id, name: s.name, stop: true, garage: s.kind === "garage" }))];
const SETTLE = 2, GIVE_UP = 25, START = 1; // seconds

export function createBigCheck(game) {
  const rows = [], stops = [];
  let i = -1, t = 0, settled = -1;
  game.bigReport = { done: false, rows, stops, rescues: 0 };
  const above = () => { const p = game.player; return +(p.pos.y - heightAt(p.pos.x, p.pos.z)).toFixed(2); };

  function spotRow(v, secs, s) {
    const life = game.big.life ? game.big.life() : null, sites = game.big.sites(), roads = game.big.roads();
    rows.push({
      spot: v.name, biome: s.biome, settleS: +secs.toFixed(1), tiles: s.tilesLoaded, byDetail: s.byDetail.join("/"), colliders: s.collidersLive, pending: s.pending,
      buildMaxMs: s.buildMs.max, drawCalls: s.drawCalls, ktris: s.ktris, frameMs: s.frameMs, heapMB: s.heapMB, aboveGround: above(),
      roads: roads ? roads.shown : 0, places: sites ? sites.live.length : 0, placeMaxMs: sites ? sites.buildMs.max : 0,
      scatter: life ? life.scatter.shown : 0, weather: life ? life.look.weather : null,
    });
  }
  function stopRow(v, secs) {
    const p = game.player, Z = game.onfoot.zones, z = Z.at(p.pos.x, p.pos.z), sites = game.big.sites();
    const marks = z ? game.onfoot.landmarks.filter((m) => Z.at(m.x, m.z) === z) : [];
    stops.push({
      stop: v.name, settleS: +secs.toFixed(1), built: !!sites && sites.live.includes(v.id), ring: z ? z.id : null,
      insideM: z ? +(z.r - Math.hypot(p.pos.x - z.x, p.pos.z - z.z)).toFixed(1) : null,
      gunsOff: !!z && game.weaponsSafeAt(p.pos.x, p.pos.z) && !game.weaponsSafeAt(z.x + z.r + 6, z.z),
      traders: marks.filter((m) => m.kind === "trader").length, bay: marks.some((m) => m.kind === "garage"),
      garage: !!v.garage, repairPct: Math.round((p.hull / p.maxHull - 0.5) * 100), aboveGround: above(),
    });
  }

  return {
    frame(dt, real) {
      if (game.bigReport.done || game.loop.paused) return;
      t += real;
      if (i < 0) { if (t < START) return; game.big.enter("ashmark"); }
      else {
        const s = game.big.state(), calm = s.pending === 0 && !s.held;
        if (calm && settled < 0) settled = t;
        // A spot stays at least 4 s, so the weather of its biome has arrived: the look turns after 3 s there (look.js).
        const due = settled >= 0 && t - settled >= SETTLE && (VISITS[i].stop || t >= 4);
        if (!due && t < GIVE_UP) return;
        const v = VISITS[i], secs = settled >= 0 ? settled : t;
        if (v.stop) stopRow(v, secs); else spotRow(v, secs, s);
        game.bigReport.rescues += s.rescues; // big.resetMax() clears the count at every visit
      }
      i++; t = 0; settled = -1;
      if (i >= VISITS.length) { game.player.hull = game.player.maxHull; game.bigReport.done = true; console.table(rows); console.table(stops); return; }
      game.big.teleport(VISITS[i].id);
      game.big.resetMax();
      if (VISITS[i].stop) game.player.hull = game.player.maxHull * 0.5; // a garage mends it while the car waits
    },
  };
}