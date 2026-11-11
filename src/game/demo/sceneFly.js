// Reel scene "Take flight": the Scrap Hornet lifts off the highway, flies a loop and a low pass with W / A / S / D
// air control and shoots up the Rattler cars on the road. The helicopter is the aircraft every player can own, so
// the reel borrows a hangar for it (the save is restored on stop). Controls go through game.air.hold, the same
// path the keys use; the guns use the AI's gunnery code.
import { roadSpawn } from "@/game/world/spawn";
import { airSave, today } from "@/game/air/tiers";
import { holdFire } from "@/game/ai/steer";
import { clearAI } from "@/game/rules/population";
import { createTimeline } from "@/game/demo/timeline";
import { heli, holdAlt, bearing, engage, clamp } from "@/game/demo/pilot";

const TARGETS = [{ s: 296, kind: "pickup" }, { s: 316, kind: "buggy" }, { s: 338, kind: "buggy" }, { s: 358, kind: "buggy" }];

export const fly = {
  id: "fly", name: "Take flight", dur: 31, seed: 5101,

  setup(c) {
    const g = c.game, others = g.vehicles.filter((v) => v !== g.player);
    g.respawnPlayer(roadSpawn(g.world, { road: "highway", s: 118, dir: 1 }, others));
    Object.assign(airSave(g.save), { owned: true, hp: null, fuel: null, paidDay: today() }); // a borrowed hangar, paid up
    g.demo.allowAir = true;
    const r = g.air.spawn("heli", { admin: false });
    g.demo.allowAir = false;
    if (!r.ok) { console.warn("[demo] Take flight skipped:", r.msg); return false; }
    g.player.god = true;
    c.data.targets = TARGETS.map((t) => g.ai.makeRattler(roadSpawn(g.world, { road: "highway", s: t.s, dir: -1 }, g.vehicles), null, t.kind));
    const cut = (kind, dur, o) => c.dir.cut(kind, dur, o);
    c.data.tl = createTimeline([
      [0, () => cut("low", 3.4)],
      [3.4, () => cut("chase", 3)],
      [6.4, () => cut("orbit", 4.2, { radius: 22, speed: 0.55, follow: true, height: 7 })],
      [10.6, () => cut("high", 3.6)],
      [14.2, () => cut("chase", 3.4)],
      [17.6, () => cut("trackside", 3.8, { lead: 70, offset: 16, height: 2.5 })],
      [21.4, () => cut("low", 3.4)],
      [24.8, () => cut("flyby", 3.4)],
      [28.2, () => cut("chase", 3)],
    ]);
  },

  step(c, dt, t) { c.data.tl.run(t); },

  // The pilot: lift off (Space), a banked loop (W + E + D), a weave (W with A / D), a low pass at the targets, climb out.
  drive(c, dt, t) {
    const g = c.game, v = g.player;
    if (!v.air || !v.alive) return;
    const s = v.flight, tgt = c.data.targets.find((x) => x.alive && x.pos.distanceTo(v.pos) < 420) || null;
    const aim = tgt ? bearing(s, tgt.pos.x, tgt.pos.z) : { dist: 999, err: 0 };
    let ctl;
    if (t < 4.4) ctl = { up: true, fwd: t > 3 ? 0.35 : 0 };
    else if (t < 12.8) ctl = { fwd: 1, turn: 0.45, right: 0.3, ...holdAlt(s, 42) };
    else if (t < 17.6) ctl = { fwd: 1, turn: clamp(-aim.err * 2, -1, 1), right: Math.sin(t * 3.2) > 0 ? 0.8 : -0.8, ...holdAlt(s, 16) };
    else if (t < 27) ctl = { fwd: clamp(aim.dist / 60, 0.45, 1), turn: clamp(-aim.err * 2.2, -1, 1), ...holdAlt(s, 9, 1.2) };
    else ctl = { fwd: 1, up: true };
    heli(g, ctl);
    if (t > 11 && t < 27) engage(g, v, 210); else holdFire(v);
  },

  info(c) {
    const t = c.D.segT, left = (c.data.targets || []).filter((x) => x.alive).length;
    const caption = t < 4.4 ? "Lift off" : t < 12.8 ? "Loop" : t < 17.6 ? "Weave" : t < 27 ? "Low pass" : "Climb out";
    return { caption, stats: t > 11 ? [["Targets", left]] : [] };
  },

  end(c) {
    const g = c.game;
    g.demo.allowAir = false;
    if (g.air.active()) g.air.exit(true); // the car comes back beside it
    if (g.player) g.player.god = false;
    const mine = c.data.targets || [];
    clearAI(g, (v) => mine.includes(v));
  },
};
