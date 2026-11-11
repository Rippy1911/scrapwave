// Reel scene "Build your base": claim a plot, raise walls in Tier I wood, Tier II concrete and Tier III steel, hang
// a steel gate, bolt on MG and rocket turrets, lay a garage pad, then four Rattlers raid it and the base holds.
// Everything goes through the real base code (placePiece, requestBuild, the raid brains); the reel only picks the
// order, the spots and the camera. The plot, its pieces and the raiders are removed again when the scene ends.
// Plot-local metres: +x east (the front, with the gate), +z south; the Rig stands at 0, 0.
import * as THREE from "three";
import { poseAt, surfaceY } from "@/game/world/spawn";
import { clearAI } from "@/game/rules/population";
import { createTimeline } from "@/game/demo/timeline";
import { engage } from "@/game/demo/pilot";
import { AI } from "@/game/data/tuning";

const PLOTS = ["p1", "p9", "p11", "p3"]; // first free one wins
const FUNDS = 6000; // banked scrap for the build (the save is restored when the reel stops)
const RAID_AT = 13.8, RAIDERS = 4, RAID_DIST = 95, RAID_DIR = new THREE.Vector2(0.96, 0.28).normalize();
const MATS = { 1: ["wood", "I · wood"], 2: ["concrete", "II · concrete"], 3: ["steel", "III · steel"] };

export const build = {
  id: "base", name: "Build your base", dur: 35, seed: 9307,

  setup(c) {
    const g = c.game, B = g.base;
    if (B.mine()) return false; // a real base of the player's own: never touch it
    const plot = PLOTS.map((id) => B.plots.byId[id]).find((p) => p && !p.owner);
    if (!plot) return false;
    Object.assign(c.data, { plot, raiders: [], caption: "", raided: false });
    g.save.banked = Math.max(g.save.banked, FUNDS);
    // The car waits on the future garage pad, inside the walls.
    g.respawnPlayer(poseAt(g.world, plot.x - 6, plot.z + 6, 90));
    g.player.god = true;

    const world = (lx, lz) => new THREE.Vector3(plot.x + lx, g.world.terrain.heightAt(plot.x + lx, plot.z + lz), plot.z + lz);
    const cut = (kind, dur, o) => c.dir.cut(kind, dur, o);
    const orbit = (lx, lz, radius, height, speed, dur) => cut("orbit", dur, { at: world(lx, lz), fixed: true, radius, height, speed });
    // Pieces: kind, tier (1 wood, 2 concrete, 3 steel), local spot, yaw in degrees.
    const put = (kind, tier, lx, lz, yaw = 0) => {
      const r = B.placePiece({ kind, mat: MATS[tier][0], tier, lx, lz, yaw: (yaw * Math.PI) / 180 }, { quiet: true });
      if (!r.ok) console.warn("[demo] piece refused:", kind, lx, lz, r.reason);
    };
    const mod = (kind, x, z, rot = 0) => { if (!B.requestBuild(plot.id, kind, x, z, rot)) console.warn("[demo] module refused:", kind, x, z); };
    const caption = (text) => () => { c.data.caption = text; };
    // A line of pieces, one every dt seconds from t0: [[lx, lz], ...] at the given yaw.
    const line = (kind, tier, spots, yaw, t0, dt) => spots.map(([lx, lz], i) => [t0 + i * dt, () => put(kind, tier, lx, lz, yaw)]);

    const cues = [
      [0, () => orbit(0, 0, 40, 20, 0.25, 4.4)],
      [1, () => { // the plot is claimed: the Rig rises out of the ground
        B.handlers.onWorld({ t: "claim", plot: plot.id, by: g.selfId(), name: "You" });
        c.data.caption = "Claim a plot";
      }],
      [2.4, caption(`Tier ${MATS[1][1]} walls`)],
      ...line("wall", 1, [-8, -4, 0, 4, 8].map((x) => [x, -10]), 0, 2.6, 0.35),
      [4.4, () => orbit(-4, 4, 26, 10, 0.35, 4.6)],
      [4.8, caption(`Tier ${MATS[2][1]} walls`)],
      ...line("wall", 2, [-6, -2, 2, 6].map((z) => [-10, z]), 90, 5, 0.28),
      ...line("wall", 2, [-8, -4, 0, 4, 8].map((x) => [x, 10]), 0, 6.3, 0.25),
      [8.2, caption(`Tier ${MATS[3][1]} gate`)],
      [8.4, () => orbit(10, 0, 18, 6, 0.45, 4.2)],
      [8.4, () => put("gate", 3, 10, 0, 90)],
      ...line("barrier", 3, [[10, -5], [10, 5]], 90, 9, 0.3),
      ...line("halfwall", 3, [[10, -8], [10, 8]], 90, 9.6, 0.3),
      [10.3, caption("MG and rocket turrets")],
      [10.5, () => mod("mgturret", 7.5, -4.5, 0)],
      [10.8, () => mod("mgturret", 7.5, 4.5, 0)],
      [11.1, () => mod("mgturret", 7.5, 0, 0)],
      [11.4, () => mod("rocketturret", 7.5, -8, 0)],
      [11.7, () => mod("rocketturret", 7.5, 8, 0)],
      [12.2, caption("Garage")],
      [12.3, () => mod("garagepad", -6, 6, 0)],
      [12.3, () => cut("high", 1.5)],
      [RAID_AT - 0.2, caption("Rattler raid!")],
      [RAID_AT, () => raid(c)],
      // The raid, filmed from high and wide so the gate, the raiders and the turrets stay in frame.
      [RAID_AT, () => orbit(26, 2, 26, 14, 0.3, 5)],
      [RAID_AT + 5, () => orbit(10, 0, 22, 12, 0.35, 5)],
      [RAID_AT + 10, () => orbit(14, 0, 30, 16, 0.25, 5)],
      [RAID_AT + 15, () => orbit(4, 0, 44, 26, 0.18, 6.5)],
    ];
    c.data.tl = createTimeline(cues);
  },

  step(c, dt, t) { c.data.tl.run(t); },

  // The owner's car holds the garage and shoots whatever it can see (the plot's own safe zone drops while raiders come).
  drive(c) {
    const g = c.game, p = g.player;
    if (!p.alive) return;
    Object.assign(p.ctl, { throttle: 0, brake: 0, steer: 0, handbrake: true, turbo: false });
    if (c.data.raided) engage(g, p, 160); else { p.ctl.fire = false; p.ctl.rockets = false; }
  },

  end(c) {
    const g = c.game, B = g.base, d = c.data, plot = d.plot;
    if (g.player) g.player.god = false;
    if (!plot) return;
    const mine = d.raiders || [];
    clearAI(g, (v) => mine.includes(v));
    B.modules.clearPlot(plot.id, "now"); // the Rig, the modules and (wrapped in basePieces) every piece
    B.plots.setOwner(plot.id, null);
    B.claimed.delete(g.selfId());
    if (B.wallet.plot === plot.id) B.wallet.plot = null;
    plot.waves = 0; plot.nextRaid = null;
  },

  info(c) {
    const d = c.data, g = c.game;
    if (!d.plot) return null;
    const rig = g.base.modules.rigOf(d.plot.id);
    const stats = [];
    if (d.raided) {
      stats.push(["Raiders", d.raiders.filter((v) => v.alive).length], ["Rig", rig ? `${Math.round((rig.hp / rig.maxHp) * 100)}%` : "down"]);
    }
    return { caption: d.caption, stats };
  },
};

// Four Rattler buggies on the open ground east of the plot, aimed at the Rig, raid brains on (the same set-up as the
// game's own wave): they breach what stands in the way and the turrets answer.
function raid(c) {
  const g = c.game, B = g.base, plot = c.data.plot, d = c.data;
  d.raided = true;
  const cx = plot.x + RAID_DIR.x * RAID_DIST, cz = plot.z + RAID_DIR.y * RAID_DIST;
  for (let i = 0; i < RAIDERS; i++) {
    const side = (i - (RAIDERS - 1) / 2) * 9, x = cx - RAID_DIR.y * side, z = cz + RAID_DIR.x * side;
    const v = g.ai.makeRattler({ x, y: surfaceY(g.world, x, z), z, heading: Math.atan2(-(plot.x - x), -(plot.z - z)) }, null, "buggy");
    v.skillName = "rookie"; v.skill = AI.skills.rookie; v.spreadMul = v.skill.spread / 0.03; // the same crew every play
    v.brain.raid = plot.id; v.brain.raidState = "approach"; v.brain.home = { x, z };
    d.raiders.push(v);
  }
  B.alertMine(`Rattler raid inbound: ${RAIDERS} cars heading for ${plot.name}!`, { x: cx, z: cz });
}
