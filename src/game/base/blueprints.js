// Named base blueprints: the whole layout (pieces and modules) of your plot. Save, load, rename, delete, export
// and import a share code. Loading rebuilds only what is missing and charges only for that.
// Stored in localStorage (in memory for scripted test runs, so they never touch your saves).
import { local } from "@/game/core/safeStorage";
const KEY = "scrapwake-base-blueprints-v1", CODE = "SWB1.";
const mem = {};
const r2 = (v) => Math.round(v * 100) / 100;

export function createBlueprints(game) {
  const base = game.base;
  const read = () => { if (game.noSave) return mem; return local.getJSON(KEY, null) || {}; };
  const write = (all) => { if (game.noSave) Object.assign(mem, all); else local.setJSON(KEY, all); };

  function capture(plot) {
    const pieces = base.pieces.group(`plot:${plot.id}`).filter((p) => p.alive && !p.fall)
      .map((p) => [p.kind, p.mat, p.tier, r2(p.lx), r2(p.y0 - plot.y), r2(p.lz), Math.round((p.yaw * 180) / Math.PI)]);
    const modules = base.modules.forPlot(plot.id).filter((e) => e.kind !== "rig").map((e) => [e.kind, e.x, e.z, e.rot]);
    return { v: 1, pieces, modules };
  }
  const spec = ([kind, mat, tier, lx, ly, lz, deg]) => ({ kind, mat, tier, lx, ly, lz, yaw: (deg * Math.PI) / 180 });
  const has = (plot, s) => base.pieces.group(`plot:${plot.id}`).some((p) => p.alive && p.kind === s.kind && Math.abs(p.lx - s.lx) < 0.3 && Math.abs(p.lz - s.lz) < 0.3 && Math.abs(p.y0 - plot.y - s.ly) < 0.6);

  const bp = {
    list() {
      const all = read();
      return Object.keys(all).sort().map((name) => ({ name, pieces: all[name].pieces.length, modules: all[name].modules.length, saved: all[name].saved || 0 }));
    },
    get: (name) => read()[name] || null,
    save(name) {
      const plot = base.mine();
      name = String(name || "").trim().slice(0, 32);
      if (!plot || !name) return false;
      const all = read();
      all[name] = { ...capture(plot), saved: Date.now() };
      write(all);
      return true;
    },
    rename(from, to) {
      const all = read(); to = String(to || "").trim().slice(0, 32);
      if (!all[from] || !to || all[to]) return false;
      all[to] = all[from]; delete all[from];
      if (game.noSave) delete mem[from];
      write(all); return true;
    },
    remove(name) { const all = read(); if (!all[name]) return false; delete all[name]; if (game.noSave) delete mem[name]; write(all); return true; },
    exportCode(name) {
      const b = read()[name];
      if (!b) return null;
      const bin = unescape(encodeURIComponent(JSON.stringify({ n: name, p: b.pieces, m: b.modules })));
      return CODE + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    importCode(code, name = null) {
      try {
        const s = String(code).trim().replace(CODE, "").replace(/-/g, "+").replace(/_/g, "/");
        const o = JSON.parse(decodeURIComponent(escape(atob(s))));
        if (!Array.isArray(o.p) || !Array.isArray(o.m) || o.p.length > 400) return null;
        const all = read();
        let n = String(name || o.n || "Imported").slice(0, 32);
        while (all[n]) n = n.replace(/( \d+)?$/, (m) => ` ${(parseInt(m, 10) || 1) + 1}`);
        all[n] = { v: 1, pieces: o.p, modules: o.m, saved: Date.now() };
        write(all);
        return n;
      } catch { return null; }
    },
    // What rebuilding would place and cost right now.
    missing(name) {
      const b = read()[name], plot = base.mine();
      if (!b || !plot) return null;
      const miss = b.pieces.map(spec).filter((s) => !has(plot, s));
      return { pieces: miss.length, cost: miss.reduce((n, s) => n + base.pieceCost(s), 0) };
    },
    // Rebuild: lowest pieces first so stacks have their supports; already standing pieces are skipped and free.
    load(name, o = {}) {
      const b = read()[name], plot = base.mine();
      if (!b || !plot) return null;
      const out = { placed: 0, kept: 0, short: 0, blocked: 0, cost: 0, modules: 0 };
      for (const s of b.pieces.map(spec).sort((a, c) => a.ly - c.ly)) {
        if (has(plot, s)) { out.kept++; continue; }
        const r = base.placePiece(s, { quiet: true, free: o.free });
        if (r.ok) { out.placed++; out.cost += r.cost; } else if (r.reason === "scrap") out.short++; else out.blocked++;
      }
      for (const [module, x, z, rot] of b.modules) {
        const why = base.validate(plot, module, x, z, rot);
        if (!why && base.requestBuild(plot.id, module, x, z, rot)) out.modules++;
      }
      game.emit({ type: "minor", text: `BLUEPRINT ${name.toUpperCase()}: ${out.placed} BUILT · ${out.kept} STANDING${out.short ? ` · ${out.short} SHORT OF SCRAP` : ""}` });
      return out;
    },
  };
  return bp;
}