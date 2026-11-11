// Short base self-check: window.scrapwake.base.check() → { pass, results }. Claims a plot if you have none,
// then tests materials, stacking and falling, repair, blueprints and the fortresses. Pieces it builds are removed.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function baseCheck(game) {
  const b = game.base, out = [];
  const ok = (name, pass, info = "") => out.push({ name, pass: !!pass, info });
  if (!b.mine()) {
    const p = b.plots.list.filter((x) => !x.owner).sort((a, c) => Math.hypot(a.x - game.player.pos.x, a.z - game.player.pos.z) - Math.hypot(c.x - game.player.pos.x, c.z - game.player.pos.z))[0];
    if (p) b.requestClaim(p.id);
    await wait(800);
  }
  const plot = b.mine();
  ok("plot claimed", plot, plot ? plot.name : "no free plot");
  if (plot) {
    const place = (s) => b.placePiece({ mat: "concrete", tier: 1, yaw: 0, ...s }, { free: true, quiet: true, instant: true });
    const w = place({ kind: "wall", lx: -12, lz: 14 }), pc = w.ok && b.pieces.byId.get(w.id);
    ok("place concrete wall", pc, w.reason || "");
    if (pc) {
      const mg = b.pieces.damage(pc, 100, "mg", null), rk = b.pieces.damage(pc, 100, "rocket", null);
      ok("MG barely chips concrete", mg < 10 && rk > mg * 8, `mg ${mg.toFixed(1)} · rocket ${rk.toFixed(1)}`);
      const top = place({ kind: "wall", lx: -12, lz: 14 }), tp = top.ok && b.pieces.byId.get(top.id);
      ok("stacks on the wall below", tp && tp.y0 > pc.y0 + 2, tp ? `y ${tp.y0.toFixed(1)}` : top.reason);
      game.save.banked += 500;
      ok("repair cost for damage", b.repairCost() > 0, `${b.repairCost()} scrap`);
      b.repairPieces();
      ok("repair restores HP", pc.hp >= pc.maxHp - 0.5);
      ok("blueprint saved", b.blueprints.save("_selfcheck"));
      const code = b.blueprints.exportCode("_selfcheck"), imp = b.blueprints.importCode(code, "_selfcheck_in");
      ok("share code round trip", imp && b.blueprints.get(imp).pieces.length === b.blueprints.get("_selfcheck").pieces.length);
      b.pieces.breakPiece(pc);
      ok("unsupported piece falls", tp && (tp.fall || !tp.alive), "");
      await wait(1500);
      const miss = b.blueprints.missing("_selfcheck");
      ok("blueprint sees missing pieces", miss && miss.pieces >= 1, miss ? `${miss.pieces} missing · ${miss.cost} scrap` : "");
      const r = b.blueprints.load("_selfcheck", { free: true });
      ok("blueprint rebuilds only what is missing", r && r.placed === miss.pieces, r ? `${r.placed} built · ${r.kept} kept` : "");
      for (const x of b.pieces.group(`plot:${plot.id}`).filter((q) => Math.abs(q.lx + 12) < 0.5 && Math.abs(q.lz - 14) < 0.5)) b.removePiece(x.id, false);
      b.blueprints.remove("_selfcheck"); b.blueprints.remove(imp);
    }
  }
  b.forts.start(); // test/accel modes skip fortresses at load
  const forts = b.forts.state();
  ok("three fortresses", forts.length === 3 && forts.every((f) => f.core && f.turrets > 0), forts.map((f) => `${f.name} ${f.pieces}`).join(" · "));
  const f = forts.find((x) => x.state === "standing");
  if (f) {
    const core = b.pieces.byId.get(f.core.id);
    b.pieces.damage(core, 1e6, "rocket", null, game.player);
    ok("wrecked core drops the fortress", b.forts.state().find((x) => x.id === f.id).state === "fallen");
  }
  return { pass: out.every((r) => r.pass), results: out };
}