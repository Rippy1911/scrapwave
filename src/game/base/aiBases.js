// Drifter bases (host): up to three Drifters claim free plots during a cycle and build a small layout over
// time. Online the server charges their own wallet (they bank in town like players); offline they build free.
import { net } from "@/game/net/net";

const PLAN = [
  ["refinery", 8, 8, 0], ["scrapwall", -4, -6, 0], ["scrapwall", -2, -6, 0], ["scrapwall", 0, -6, 0], ["scrapwall", 2, -6, 0], ["scrapwall", 4, -6, 0],
  ["mgturret", -8, -8, 0], ["platewall", -6, 4, 1], ["platewall", 6, 4, 1], ["spikewall", -4, 6, 0], ["spikewall", 4, 6, 0], ["rocketturret", 8, -8, 0],
];

export function createAiBases(game) {
  const base = game.base, send = (k, d) => net.impl().sendEvent(k, d);
  let claimT = 70, buildT = 12;

  game.onAiBank = (v, e, scrap) => {
    if (net.mode !== "online" || !net.isHost() || !v.netId) return;
    for (let left = Math.round(scrap); left > 0; left -= 5000) send("bank", { scrap: Math.min(5000, left), at: "town", ai: v.netId, name: v.name });
  };

  function claimOne() {
    const owners = new Set(base.plots.list.filter((p) => p.owner).map((p) => p.owner.id));
    if ([...owners].filter((id) => id.startsWith("adr")).length >= 3) return;
    const v = game.vehicles.find((x) => x.team === "drifter" && x.alive && !x.remote && x.netId && !owners.has(x.netId) && !base.claimed.has(x.netId));
    const mine = base.mine();
    const free = base.plots.list.filter((p) => !p.owner && (!mine || Math.hypot(p.x - mine.x, p.z - mine.z) > 150));
    if (!v || !free.length) return;
    const plot = free.sort((a, b) => Math.hypot(a.x - v.pos.x, a.z - v.pos.z) - Math.hypot(b.x - v.pos.x, b.z - v.pos.z))[0];
    base.requestClaim(plot.id, { id: v.netId, name: v.name });
  }

  function buildNext() {
    for (const p of base.plots.list) {
      if (!p.owner || !p.owner.id.startsWith("adr") || p.dark || !base.modules.rigOf(p.id)) continue;
      const have = base.modules.forPlot(p.id);
      const next = PLAN.find(([k, x, z]) => !have.some((e) => e.kind === k && e.x === x && e.z === z));
      if (next) base.requestBuild(p.id, next[0], next[1], next[2], next[3], { id: p.owner.id, name: p.owner.name });
    }
  }

  return {
    step(dt) {
      if (!net.isHost() || !game.cycleSys || game.cycleSys.phase() !== "run") return;
      claimT -= dt;
      if (claimT <= 0) { claimT = 90 + Math.random() * 60; claimOne(); }
      buildT -= dt;
      if (buildT <= 0) { buildT = 18 + Math.random() * 10; buildNext(); }
    },
    reset() { claimT = 60 + Math.random() * 30; buildT = 12; },
  };
}