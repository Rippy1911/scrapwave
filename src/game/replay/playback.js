// Instant replay: offers (wreck someone, big air, your own wreck), then plays ~10 s around the key moment from the
// recorder with cinematic cuts, played at 1x. Moves meshes only; the simulation is held and resumes untouched.
import * as THREE from "three";
import { REPLAY } from "@/game/data/tuning";
import { STRIDE } from "@/game/replay/recorder";
import { newShot, applyShot } from "@/game/replay/shots";

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), key = new THREE.Vector3();
const LABEL = { wreck: "Takedown", jump: "Big air", wrecked: "Your wreck", manual: "Last 10 seconds" };

export function createReplay(game, rec) {
  const R = { active: false, t: 0, t0: 0, t1: 0, keyT: 0, reason: "", focus: null, shot: null, seg: -1, lastEv: 0, pending: null };

  // Offer a replay of something that just happened (shown for REPLAY.offerTime).
  R.mark = (reason, focus, ttl = REPLAY.offerTime) => {
    if (game.autopilot || R.active) return;
    R.pending = { reason, focus, keyT: game.time, until: game.time + ttl };
  };
  R.offer = () => (R.pending && game.time < R.pending.until && !R.active ? { reason: R.pending.reason, label: LABEL[R.pending.reason], left: R.pending.until - game.time } : null);

  R.start = (o = R.pending) => {
    if (R.active || rec.count() < REPLAY.hz) return false;
    const keyT = o ? o.keyT : game.time - 2;
    R.reason = o ? o.reason : "manual";
    R.focus = (o && o.focus && o.focus.mesh.root.parent) ? o.focus : game.player;
    R.t1 = Math.min(rec.newest(), keyT + 3);
    R.t0 = Math.max(rec.oldest(), R.t1 - REPLAY.length);
    // Start where the focus car exists (a respawn or teleport replaces the player's car).
    for (let i = rec.find(R.t0), n = rec.count(); i < n - 1; i++) {
      const F = rec.frame(i), k = F.vs.indexOf(R.focus);
      if (k >= 0 && k < F.n) { R.t0 = Math.max(R.t0, F.t); break; }
    }
    if (R.t1 - R.t0 < 1) return false;
    R.keyT = Math.min(Math.max(keyT, R.t0), R.t1);
    R.t = R.t0; R.lastEv = R.t0; R.seg = -1; R.active = true; R.pending = null;
    return true;
  };

  R.stop = () => {
    if (!R.active) return;
    R.active = false;
    for (const v of game.vehicles) v.mesh.root.visible = true;
    game.cam.snap(game.player);
  };

  // Pose every recorded vehicle at playback time t; hide ones that did not exist yet.
  function pose(t, dt) {
    const i = rec.find(t), A = rec.frame(i), B = rec.frame(Math.min(rec.count() - 1, i + 1));
    const a = B.t > A.t ? Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))) : 0;
    for (const v of game.vehicles) v.mesh.root.visible = false;
    for (let n = 0; n < A.n; n++) {
      const v = A.vs[n], m = v.mesh;
      if (!m.root.parent) continue;
      let nb = B.vs.indexOf(v); if (nb < 0 || nb >= B.n) nb = -1;
      const oa = n * STRIDE, ob = nb >= 0 ? nb * STRIDE : oa, da = A.d, db = nb >= 0 ? B.d : A.d;
      m.root.visible = true;
      m.root.position.set(da[oa] + (db[ob] - da[oa]) * a, da[oa + 1] + (db[ob + 1] - da[oa + 1]) * a, da[oa + 2] + (db[ob + 2] - da[oa + 2]) * a);
      qa.set(da[oa + 3], da[oa + 4], da[oa + 5], da[oa + 6]); qb.set(db[ob + 3], db[ob + 4], db[ob + 5], db[ob + 6]);
      m.root.quaternion.slerpQuaternions(qa, qb, a);
      for (let w = 0; w < m.wheels.length && w < 6; w++) {
        const wm = m.wheels[w], wd = wm.def;
        if (wm.part.detached) continue;
        const comp = da[oa + 10 + w * 2];
        wm.pivot.position.y = wd.pos[1] + (comp >= 0 ? comp - v.chassis.susLen * 0.5 : -v.chassis.susLen * 0.3);
        if (wd.steer) wm.pivot.rotation.y = -da[oa + 7];
        wm.spin.rotation.x -= da[oa + 11 + w * 2] * dt;
      }
      for (const f of m.flames) f.visible = da[oa + 9] > 0.5 && da[oa + 8] > 0.5;
    }
  }

  function playEvents(t) {
    for (const e of rec.events) {
      if (e.t <= R.lastEv || e.t > t) continue;
      if (e.type === "explode") { game.particles.explosion(e.x, e.y, e.z, e.s); game.fx.flash(e.x, e.y + 1, e.z, 600 * e.s, 0.35); game.audio.explosion(e, e.s); }
      else if (e.type === "shot") { game.fx.tracer(key.set(e.x, e.y, e.z), new THREE.Vector3(e.x2, e.y2, e.z2)); game.particles.muzzle(e.x, e.y, e.z, 0.8); }
      else if (e.type === "hit") game.particles.sparks(e.x, e.y, e.z, 5);
      else if (e.type === "part") game.particles.sparks(e.x, e.y + 0.5, e.z, 12);
    }
    R.lastEv = t;
  }

  // Shot plan: low chase → trackside through the key moment (at 1x, never slowed) → orbit the key spot.
  function pickShot() {
    const seg = R.t < R.keyT - 3 ? 0 : R.t < R.keyT + 0.6 ? 1 : 2;
    if (seg === R.seg) return;
    R.seg = seg;
    const root = R.focus.mesh.root;
    const i = rec.find(R.keyT), F = rec.frame(i), n = F.vs.indexOf(R.focus);
    if (n >= 0 && n < F.n) key.set(F.d[n * STRIDE], F.d[n * STRIDE + 1], F.d[n * STRIDE + 2]); else key.copy(root.position);
    if (seg === 0) R.shot = newShot("low", game.world, root);
    else if (seg === 1) R.shot = newShot("trackside", game.world, root, { at: key, offset: R.reason === "jump" ? 16 : 12, height: R.reason === "jump" ? 1 : 1.6 });
    else R.shot = newShot("orbit", game.world, root, { at: key, fixed: R.reason !== "jump", radius: 14 });
  }

  // Returns true while the replay owns the frame. real = real seconds (0 while paused).
  R.update = (real) => {
    if (!R.active) return false;
    if (game.input.edge("pause") || game.input.edge("smoke")) { R.stop(); return false; }
    const dt = real; // 1x, like the game
    R.t += dt;
    if (R.t >= R.t1) { R.stop(); return false; }
    pose(R.t, dt);
    playEvents(R.t);
    pickShot();
    applyShot(game.camera, game.world, R.shot, R.focus.mesh.root, real);
    return true;
  };
  R.badge = () => ({ label: LABEL[R.reason] || "Replay", k: (R.t - R.t0) / Math.max(0.01, R.t1 - R.t0) });
  return R;
}