// window.scrapwake.mech — test hooks for moving machines (installed by game/hooks.js).
import { wreckframeDesign } from "@/game/mech/wreckframe";
import { compileDesign } from "@/game/workshop/compile";
import { isMech } from "@/game/mech/mech";
import { blockReason } from "@/game/mech/transform";

export function mechHooks(game) {
  const M = () => game.mech, p = () => game.player;
  const st = () => (isMech(p()) ? M().state(p()) : null);
  const h = {
    // Mode, fold progress, pose values, position and walker numbers of your machine (null when it has no joints).
    state() {
      const s = st(), v = p();
      if (!s) return null;
      return {
        mode: s.tr ? "transforming" : v.walking ? "walker" : "drive", k: +s.k.toFixed(3), walking: !!v.walking, air: s.air,
        pos: v.pos.toArray().map((x) => +x.toFixed(2)), yaw: +s.yaw.toFixed(3), speed: +Math.hypot(v.vel.x, v.vel.z).toFixed(2),
        stance: +s.stance.toFixed(2), steps: s.steps, pose: Object.fromEntries(Object.entries(s.pose).map(([k, x]) => [k, +x.toFixed(3)])),
        hit: v.chassis.hit, fuel: +v.fuel.toFixed(1), walker: v.design.mech.walker, legs: s.rig.D.legs.length, fists: s.rig.D.fists.length,
        keys: s.keys.bound(), block: blockReason(v, s, !v.walking), fistCd: +(s.fistCd || 0).toFixed(2),
      };
    },
    // Fold now (T). Returns "" when the fold started, else why not.
    transform: () => M().toggle(),
    // Walk for a while without the keys: walk({ fwd: 1, turn: 0, strafe: 0, run: false, jump: false }, seconds).
    walk(it = {}, seconds = 2) { const s = st(); if (!s) return false; s.test = { fwd: 0, turn: 0, strafe: 0, run: false, jump: false, ...it, t: seconds }; return true; },
    stop() { const s = st(); if (s) s.test = null; return !!s; },
    // Press key n (1-9) for its pose; joint(id, value) sets a joint directly.
    key(n) { const s = st(); return s ? s.keys.press(n) : false; },
    pose(name) { const s = st(); return s ? s.keys.pose(name) : false; },
    joint(id, value) { const s = st(); if (!s) return false; s.keys.set(id, value); return true; },
    punch() { const s = st(); if (!s || !s.rig.D.fists.length) return false; s.punchReq = true; return true; },
    // Drive the Wreckframe from here (stand=true starts the fold into Walker mode).
    wreckframe(stand = true) { return M().rideWreckframe(stand); },
    scuttler(stand = true) { return M().rideScuttler(stand); }, // the four-legged preset
    design: () => wreckframeDesign(),
    stats: (d) => { const c = compileDesign(d || wreckframeDesign()); return { summary: c.summary, mech: c.mech }; },
    check: () => (game.mechReport ? { ...game.mechReport, items: [...game.mechReport.items] } : null), // ?mechcheck=1 results
    footprints: () => ({ shown: M().prints.count(), total: M().prints.total() }),
  };
  return h;
}