// Pieces and cars: gates open for their plot's owner, rams break pieces (speed lost × mass), and who may not
// hurt what (owners never chip their own base, raiders never their own fortress).
const RAM_K = 9;

export function createPieceWorld(game, pieces) {
  const base = game.base;
  const plotOf = (pc) => (pc.group.startsWith("plot:") ? base.plots.byId[pc.group.slice(5)] : null);

  base.pieceGuard = (pc, by) => {
    if (pc.group.startsWith("fort:")) return !(by.team === "rattler" || by.team === "warlord");
    const plot = plotOf(pc);
    return !(plot && base.isOwner(plot, by));
  };

  function gates() {
    for (const pc of pieces.list) {
      if (!pc.def.gate || !pc.alive) continue;
      const plot = plotOf(pc), v = plot && base.ownerVehicle(plot);
      const near = !!v && v.alive && Math.hypot(v.pos.x - pc.wx, v.pos.z - pc.wz) < 10;
      pieces.setOpen(pc, near);
    }
  }

  function nearest(v, reach) {
    let best = null, bd = reach;
    for (const pc of pieces.list) {
      if (!pc.alive || pc.fall || v.pos.y > pc.top + 1 || v.pos.y < pc.y0 - 2) continue;
      const dx = Math.max(Math.abs(v.pos.x - pc.wx) - pc.fw / 2, 0), dz = Math.max(Math.abs(v.pos.z - pc.wz) - pc.fd / 2, 0), d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = pc; }
    }
    return best;
  }

  function rams() {
    for (const v of game.vehicles) {
      if (v.remote || !v.alive || v.air) { v._pcImp = v.impacts; continue; }
      const s1 = v.vel.length(), s0 = v._pcSpd ?? s1, hit = (v.impacts || 0) !== (v._pcImp ?? v.impacts ?? 0);
      v._pcImp = v.impacts; v._pcSpd = s1;
      if (!hit || s0 - s1 < 3) continue;
      const pc = nearest(v, 3.2);
      if (pc) pieces.damage(pc, (s0 - s1) * (v.mass / 1000) * RAM_K, "ram", v.pos.clone(), v);
    }
  }

  return { step() { gates(); rams(); }, plotOf };
}