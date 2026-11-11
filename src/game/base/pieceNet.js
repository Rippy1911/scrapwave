// Pieces online: relayed `ev` events. Places, removals and repairs go out as they happen; damage is summed per
// piece and sent five times a second by the browser that dealt it (like module hits). Offline nothing is sent.
import { net } from "@/game/net/net";

export function createPieceNet(game, pieces) {
  const online = () => net.mode === "online";
  const send = (kind, data) => online() && net.impl().sendEvent(kind, data);
  const hits = new Map();
  let t = 0;

  pieces.onHurt((pc, dealt, kind, by, remote) => {
    if (remote || !online() || !(pc.group.startsWith("plot:") || pc.group.startsWith("fort:"))) return;
    const local = by === game.player || (!by && net.isHost()) || (by && !by.remote && by !== game.player && net.isHost());
    if (local) hits.set(pc.id, (hits.get(pc.id) || 0) + dealt);
  });

  return {
    placed(pc) { send("pcAdd", { g: pc.group, d: { kind: pc.kind, mat: pc.mat, tier: pc.tier, lx: pc.lx, lz: pc.lz, yaw: pc.yaw, id: pc.id }, o: { x: pc.ox, y: pc.oy, z: pc.oz } }); },
    removed(pc) { send("pcDel", { id: pc.id }); },
    repaired(pc) { send("pcFix", { id: pc.id }); },
    step(dt) {
      t -= dt;
      if (t > 0 || !hits.size) return;
      t = 0.2;
      send("pcHit", { h: [...hits].map(([id, d]) => [id, Math.round(d * 10) / 10]) });
      hits.clear();
    },
    onEvent(m) {
      if (m.kind === "pcHit") for (const [id, d] of m.h || []) pieces.damage(pieces.byId.get(id), +d, "blast", null, null, true);
      else if (m.kind === "pcAdd" && m.d && !pieces.byId.has(m.d.id)) pieces.spawn(m.g, m.d, m.o, { rise: true });
      else if (m.kind === "pcDel") pieces.remove(pieces.byId.get(m.id));
      else if (m.kind === "pcFix") { const pc = pieces.byId.get(m.id); if (pc) pieces.repair(pc); }
    },
  };
}