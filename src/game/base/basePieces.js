// Plot pieces for the base layer: place / remove / repair on your own plot with the base economy (offline:
// banked scrap then the stash; online: the scrap you carry), wired into blasts, the step and the frame.
import { net } from "@/game/net/net";
import { pieceStats, PIECE_CAP } from "@/game/base/pieceCatalog";
import { createPieces } from "@/game/base/pieces";
import { createPieceWorld } from "@/game/base/pieceWorld";
import { createPieceNet } from "@/game/base/pieceNet";
import { checkPlace, piecesBlock } from "@/game/base/snap";

const REASON = { full: `Piece cap · ${PIECE_CAP} per plot`, cap: "World piece cap reached", blocked: "Blocked", pos: "Outside the plot", scrap: "Not enough scrap", owner: "Not your plot", dark: "Base is dark" };

export function attachPieces(game) {
  const base = game.base, online = () => net.mode === "online";
  const pieces = createPieces(game), pworld = createPieceWorld(game, pieces), pnet = createPieceNet(game, pieces);
  Object.assign(base, { pieces, pieceNet: pnet, pieceWorld: pworld });
  base.pieceReason = (r) => REASON[r] || r;
  base.pieceCost = (s) => pieceStats(s.kind, s.mat, s.tier).cost;
  base.piecesBlock = (plot, x, z, w, d) => piecesBlock(game, plot, x, z, w, d);

  base.pieceFunds = () => {
    if (online()) return Math.floor(game.player.scrap);
    const p = base.mine();
    return Math.floor(game.save.banked + (p ? p.stash : 0));
  };
  base.payPieces = (plot, cost) => { if (online()) game.player.scrap = Math.max(0, game.player.scrap - cost); else base.payOffline(plot, cost); };
  base.refundPieces = (cost) => { if (online()) game.player.scrap += cost; else game.save.banked += cost; };

  // spec: { kind, mat, tier, lx, lz, yaw } on your plot. o.free skips the cost (tests), o.quiet skips the toast.
  base.placePiece = (spec, o = {}) => {
    const plot = base.mine();
    if (!plot) return { reason: "owner" };
    if (plot.dark) return { reason: "dark" };
    const r = pieces.restY(`plot:${plot.id}`, spec.kind, plot.x + spec.lx, plot.z + spec.lz, spec.yaw || 0);
    const why = checkPlace(game, plot, spec.kind, spec.lx, spec.lz, spec.yaw || 0, r.y, spec.mat, spec.tier, o.free);
    if (why) { if (!o.quiet) base.no(base.pieceReason(why)); return { reason: why }; }
    const cost = pieceStats(spec.kind, spec.mat, spec.tier).cost;
    if (!o.free) base.payPieces(plot, cost);
    const pc = pieces.spawn(`plot:${plot.id}`, spec, plot, { rise: !o.instant, y0: r.y, ground: r.ground, owner: plot.owner.id });
    pnet.placed(pc);
    game.audio.clank?.();
    return { ok: true, id: pc.id, cost: o.free ? 0 : cost };
  };
  base.removePiece = (id, refund = true) => {
    const pc = pieces.byId.get(id), plot = base.mine();
    if (!pc || !plot || pc.group !== `plot:${plot.id}`) return false;
    if (refund) base.refundPieces(Math.floor(pc.cost * 0.5 * (pc.hp / pc.maxHp)));
    pieces.remove(pc); pnet.removed(pc);
    return true;
  };
  const damaged = (plot) => pieces.group(`plot:${plot.id}`).filter((pc) => pc.alive && pc.hp < pc.maxHp - 0.5);
  base.repairCost = (plot = base.mine()) => (plot ? Math.ceil(damaged(plot).reduce((n, pc) => n + pc.cost * 0.6 * (1 - pc.hp / pc.maxHp), 0)) : 0);
  // Repair at the base: every damaged piece on your plot for scrap (as much as you can pay, most-hurt first).
  base.repairPieces = () => {
    const plot = base.mine();
    if (!plot) return 0;
    let n = 0;
    for (const pc of damaged(plot).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)) {
      const c = Math.ceil(pc.cost * 0.6 * (1 - pc.hp / pc.maxHp));
      if (base.pieceFunds() < c) break;
      base.payPieces(plot, c); pieces.repair(pc); pnet.repaired(pc); n++;
    }
    if (n) { game.emit({ type: "minor", text: `REPAIRED ${n} PIECE${n > 1 ? "S" : ""}` }); game.audio.clank?.(); }
    return n;
  };

  const blast = base.blast;
  base.blast = (pos, radius, dmg, attacker, weapon) => { blast(pos, radius, dmg, attacker); pieces.blast(pos, radius, dmg, attacker, weapon); };
  const clearPlot = base.modules.clearPlot;
  base.modules.clearPlot = (plotId, mode) => { pieces.clearGroup(`plot:${plotId}`, mode !== "now"); return clearPlot(plotId, mode); };
  const step = base.step, frame = base.frame;
  base.step = (dt) => { step(dt); pieces.step(dt); pworld.step(dt); pnet.step(dt); };
  base.frame = (dt) => { frame(dt); pieces.frame(dt, game.camera.position); };
  return pieces;
}