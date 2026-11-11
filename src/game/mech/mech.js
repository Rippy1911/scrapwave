// game.mech: moving machines. Any car built with a Transform Core gets a rig: keys 1-9 move its bound joints and
// poses, T folds it between Drive and Walker mode, and in Walker mode it walks (src/game/mech/walk.js), steps with
// footprints and shakes, and throws its ram fist. Runs for every local machine; the HUD reads hud().
import * as THREE from "three";
import { createRig } from "@/game/mech/rig";
import { createGait } from "@/game/mech/gait";
import { createJointKeys } from "@/game/mech/keys";
import { walkStep, playerIntent, ctlIntent } from "@/game/mech/walk";
import { startTransform, transformStep, blockReason } from "@/game/mech/transform";
import { fistStep, punchK } from "@/game/mech/fist";
import { createFootprints, footstep } from "@/game/mech/footprints";
import { wreckframeDesign } from "@/game/mech/wreckframe";
import { scuttlerDesign } from "@/game/mech/scuttler";
import { createMechCheck } from "@/game/mech/check";
import { placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";

const at = new THREE.Vector3(), e = new THREE.Euler();
export const isMech = (v) => !!(v && v.design && v.design.mech && v.design.mech.joints > 0);
const hasCore = (v) => !!(v && v.design && v.design.mech && v.design.mech.core);

export function createMech(game) {
  const prints = createFootprints(game.scene);
  const digit = (n) => game.input.held("Digit" + n) || game.input.held("Numpad" + n);

  function state(v) {
    if (!isMech(v)) return null;
    if (v.mechState && v.mechState.mesh === v.mesh) return v.mechState;
    const rig = createRig(v.mesh, v.design.design);
    const st = { mesh: v.mesh, rig, k: 0, tr: null, yaw: 0, vy: 0, air: false, stance: rig.D.T.stance, driveH: 1, pose: {}, idle: true, steps: 0 };
    st.gait = createGait(rig.D);
    st.keys = createJointKeys(rig.D, v.design.design.free?.poses || []);
    v.mechState = st;
    return st;
  }
  const onStep = (v, st) => (L) => {
    const o = st.rig.objOf(L.foot);
    if (o) o.getWorldPosition(at); else at.copy(v.pos);
    st.steps++;
    footstep(game, prints, at, st.yaw, v.mass);
  };

  const api = {
    ownsT: () => hasCore(game.player) && game.player.alive && !game.onfoot.active() && !game.air.active(),
    state,
    toggle(v = game.player) { const st = state(v); if (!st) return "No moving parts"; return startTransform(game, v, st, !v.walking); },
    // Each fixed step after the player's controls and before physics.
    step(dt) {
      if (api.check) api.check(dt);
      const p = game.player;
      game.input.a.mechPad = api.ownsT() && isMech(p); // LB chords on the pad (core/padMech.js)
      if (game.input.a.mechPad && game.input.edge("punch") && !game.uiOpen && state(p).rig.D.fists.length) state(p).punchReq = true;
      if (api.ownsT() && game.input.edge("emote") && !game.uiOpen) { const why = api.toggle(p); if (why && why !== "Transforming") game.emit({ type: "minor", text: why.toUpperCase() }); }
      for (const v of game.vehicles) {
        if (v.remote || !isMech(v)) continue;
        const st = state(v), pose = {};
        st.keys.step(dt, v === p && !game.uiOpen && !game.onfoot.active() ? digit : () => false, pose);
        const moving = transformStep(game, v, st, dt);
        if (v.walking && !moving && v.alive) {
          const it = st.test && st.test.t > 0 ? st.test : v === p ? playerIntent(game) : ctlIntent(v.ctl);
          if (st.test) st.test.t -= dt;
          const speed = walkStep(game, v, st, v.design.mech.walker, it, dt, (hit) => { if (hit > 3) footstep(game, prints, v.pos, st.yaw, v.mass, Math.min(2.5, hit / 4)); });
          st.gait.step(dt, st.air ? 0 : speed, it.turn, it.strafe, pose, onStep(v, st));
        }
        fistStep(game, v, st, dt);
        const pk = punchK(st);
        if (pk) for (const f of st.rig.D.fists) if (f.joint) { const j = st.rig.D.info.find((x) => x.id === f.joint); if (j) pose[f.joint] = (pose[f.joint] || 0) + j.max * pk; }
        st.pose = pose;
        if (v.walking) Object.assign(v.ctl, { throttle: 0, brake: 0, steer: 0, handbrake: true, turbo: false, harpoon: false });
      }
    },
    // Each render frame, after the cars are synced: pose the rigs.
    frame() {
      for (const v of game.vehicles) {
        const st = v.mechState;
        if (!st || st.mesh !== v.mesh) continue;
        const busy = st.k > 0 || Object.values(st.pose).some((x) => Math.abs(x) > 1e-4);
        if (busy) { st.rig.apply(st.k, st.pose); st.idle = false; } else if (!st.idle) { st.rig.restore(); st.idle = true; }
      }
    },
    hud() {
      const p = game.player, st = isMech(p) ? state(p) : null;
      if (!st) return null;
      const m = p.design.mech;
      return {
        mode: st.tr ? "transforming" : p.walking ? "walker" : "drive", k: +st.k.toFixed(2), core: m.core, legs: m.legs,
        canWalk: m.core && m.walker.ok, overloaded: m.walker.overloaded, block: p.walking || st.tr ? "" : blockReason(p, st, true),
        keys: st.keys.bound(), fist: st.rig.D.fists.length > 0, hop: m.walker.hop,
        check: game.mechReport ? { stage: game.mechReport.stage, pass: game.mechReport.pass, done: game.mechReport.done, items: [...game.mechReport.items] } : null,
      };
    },
    // Admin and test hook: drive the Wreckframe from where you are; stand=true folds it into Walker mode at once.
    rideWreckframe: (stand = true) => api.rideDesign(wreckframeDesign(), stand, "WRK-1"),
    rideScuttler: (stand = true) => api.rideDesign(scuttlerDesign(), stand, "SCT-4"),
    rideDesign(design, stand = true, plate = "MCH-1") {
      const old = game.player;
      if (!old) return false;
      const yaw = e.setFromQuaternion(old.quat, "YXZ").y;
      const v = game.workshop.createDesigned(design, { team: "player", name: "You", plate });
      v.skill = old.skill; v.skillName = "you"; v.scrap = old.scrap; v.god = !!old.god;
      placeVehicle(v, old.pos.x, game.world.groundAt(old.pos.x, old.pos.z, old.pos.y + 2) + 1.2, old.pos.z, yaw);
      game.vehicles.splice(game.vehicles.indexOf(old), 1);
      removeVehicle(game, old);
      game.vehicles.push(v);
      game.player = v;
      game.cam.snap(v);
      if (stand) { const st = state(v); st.driveH = 1.2; startTransform(game, v, st, true); }
      return true;
    },
    prints,
    dispose() { prints.dispose(); },
  };
  game.mech = api;
  if (game.modes && game.modes.mechcheck) api.check = createMechCheck(game);
  return api;
}