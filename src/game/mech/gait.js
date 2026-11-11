// Procedural walk cycle: hips swing, knees lift on the swing, arms swing against the legs. Two legs alternate,
// four legs step in diagonal pairs. onStep(leg) fires when a foot plants (the hip at the front of its swing).
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createGait(D) {
  const g = { phase: 0, amp: 0, prev: new Map() };
  // speed: forward m/s (negative backing up), turn: -1..1, strafe: -1..1. Writes joint values into out.
  g.step = (dt, speed, turn, strafe, out, onStep) => {
    const move = Math.max(Math.abs(speed), Math.abs(turn) * 1.2, Math.abs(strafe) * 1.5);
    const want = move > 0.15 ? clamp(0.35 + move / 4, 0, 1) : 0;
    g.amp += (want - g.amp) * Math.min(1, dt * 6);
    const dir = speed < -0.1 ? -1 : 1;
    g.phase += dt * (move > 0.15 ? 2.2 + move * 0.9 : 0) * dir;
    for (const L of D.legs) {
      const a = g.phase + L.offset, sw = Math.sin(a), c = Math.cos(a);
      out[L.hip] = (out[L.hip] || 0) + sw * 0.5 * g.amp;
      for (const k of L.knees) out[k] = (out[k] || 0) - Math.max(0, c * dir) * 0.85 * g.amp;
      const pc = g.prev.get(L.hip);
      if (pc !== undefined && Math.sign(pc) !== Math.sign(c) && sw * dir > 0 && g.amp > 0.2) onStep(L);
      g.prev.set(L.hip, c);
    }
    for (const A of D.arms) out[A.id] = (out[A.id] || 0) - Math.sin(g.phase + A.offset) * 0.35 * g.amp;
    return g.amp;
  };
  g.reset = () => { g.amp = 0; g.prev.clear(); };
  return g;
}