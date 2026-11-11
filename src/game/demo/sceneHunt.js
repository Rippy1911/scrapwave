// Reel scene "Hunt": a Brawler hunts a zombie horde through the Quarry Bowl arena (the Horde Night rules, no rival
// cars). It drives at the thickest part of the pack, shoots as it goes and fires rockets into clumps; kills and score
// are shown in the corner. The horde, arena and gunnery are the game's own; only the steering target is scripted.
import * as THREE from "three";
import { newBrain, driveTo } from "@/game/ai/steer";
import { presetPatch } from "@/game/rules/presets";
import { validateRules } from "@/game/rules/gameRules";
import { setRules } from "@/game/rules/state";
import { createTimeline } from "@/game/demo/timeline";

const SCORE_PER_KILL = 100;
const goal = new THREE.Vector3();

// The figure with the most of the pack around it, close enough to reach: { f, n, d } or null.
function thickest(figs, p) {
  let best = null, bs = -1e9;
  for (const f of figs) {
    const d = Math.hypot(f.x - p.pos.x, f.z - p.pos.z);
    if (d > 95 || d < 2.5) continue;
    let n = 0;
    for (const o of figs) if (Math.hypot(o.x - f.x, o.z - f.z) < 7) n++;
    const score = n * 10 - d * 0.35;
    if (score > bs) { bs = score; best = { f, n, d }; }
  }
  return best;
}

export const hunt = {
  id: "hunt", name: "Hunt", dur: 32, seed: 7203,

  setup(c) {
    const g = c.game;
    const rules = validateRules({ ...presetPatch("Horde Night"), name: "Hunt", map: "quarry", horde: "zombies", hordeDensity: 0.9, aiCount: 0, powerups: false, startCar: "brawler", timeLimit: 600 });
    setRules(rules);
    g.arena.start(rules);
    g.player.god = true;
    c.data.pick = null; c.data.pickT = 0; c.data.rocketAt = -9; c.data.rocketHold = 0;
    const cut = (kind, dur, o) => c.dir.cut(kind, dur, o);
    // Only cuts that clear the quarry's walls and crates: the chase cam, a high cam and wide follow orbits.
    const orbit = (radius, height, speed) => () => cut("orbit", 4, { radius, speed, follow: true, height });
    c.data.tl = createTimeline([
      [0, () => cut("chase", 4)],
      [4, () => cut("high", 4)],
      [8, orbit(17, 9, 0.45)],
      [12, () => cut("chase", 4)],
      [16, () => cut("high", 4)],
      [20, orbit(19, 11, 0.35)],
      [24, () => cut("chase", 4)],
      [28, orbit(17, 9, 0.5)],
    ]);
  },

  step(c, dt, t) { c.data.tl.run(t); },

  drive(c, dt, t) {
    const g = c.game, p = g.player, H = g.horde, d = c.data;
    if (!p.alive) return;
    if (!p.brain) p.brain = newBrain({ mode: "roam" });
    d.pickT -= dt;
    if (d.pickT <= 0) { d.pickT = 0.3; d.pick = thickest(H.figures(), p); }
    const k = d.pick && H.figures().includes(d.pick.f) ? d.pick : null;
    if (k) goal.set(k.f.x, p.pos.y, k.f.z);
    else { const site = g.arena.map.ctx.site; goal.set(site.x, p.pos.y, site.z); }
    driveTo(p, goal, dt, { maxSpeed: 16, noHandbrake: true });
    const near = k ? Math.hypot(k.f.x - p.pos.x, k.f.z - p.pos.z) : 999;
    if (k && near < 60) { p.aimPoint.set(k.f.x, k.f.y + 0.9, k.f.z); p.lockTarget = null; p.ctl.fire = true; p.aiming = true; }
    else { p.ctl.fire = false; p.aiming = false; }
    d.rocketHold -= dt;
    if (k && k.n >= 6 && near > 22 && near < 80 && t - d.rocketAt > 3.4) { d.rocketAt = t; d.rocketHold = 0.35; }
    p.ctl.rockets = d.rocketHold > 0;
    p.ctl.harpoon = false;
  },

  end(c) {
    const g = c.game;
    if (g.player) g.player.god = false;
    if (g.arena.active) g.arena.leave(); // back to the open world with Classic rules
  },

  info(c) {
    const g = c.game, k = g.horde.kills();
    return { caption: "Zombie hunt", stats: [["Kills", k], ["Score", k * SCORE_PER_KILL], ["Left", g.horde.remaining()]] };
  },
};
