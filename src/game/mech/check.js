// ?mechcheck=1 — scripted walker check through the same paths the keys use: compile the Wreckframe, fold it into
// Walker mode, walk, turn, jump, blend a pose, punch, fold back and drive; plus the free-build edit ops and the
// share-code round trip. Results: game.mechReport (shown on the walker HUD card, and window.scrapwake.mech.check()).
import * as THREE from "three";
import { compileDesign } from "@/game/workshop/compile";
import { addPart, createHistory } from "@/game/workshop/freeEdit";
import { encodeDesign, decodeDesign } from "@/game/workshop/blueprints";
import { presetByName } from "@/game/workshop/designs";
import { normalizeDesign } from "@/game/workshop/validate";
import { wreckframeDesign } from "@/game/mech/wreckframe";
import { dataChecks } from "@/game/mech/checkData";
import { moreStages } from "@/game/mech/check12";
import { surfaceY } from "@/game/world/spawn";
import { local } from "@/game/core/safeStorage";

export function createMechCheck(game) {
  const r = game.mechReport = { stage: "wait", items: [], errors: 0, pass: false, done: false };
  const onErr = (ev) => { r.errors++; r.lastError = String(ev.message || (ev.reason && ev.reason.message) || ev.reason || "").slice(0, 80); };
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onErr);
  const ok = (name, v, note = "") => r.items.push({ name, ok: !!v, note: String(note) });
  let t = 0, mark = null;
  const st = () => game.mech.state(game.player), p = () => game.player;
  const shots = () => p().weapons.reduce((n, w) => n + (w.flip || 0), 0);
  const next = (s) => { r.stage = s; t = 0; };
  const stages = {
    wait() {
      if (t < 0.5 || game.introT > 0) return;
      // 110 m on down the highway from the gate, out of the Well-town: no guns inside safe zones.
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(p().quat), x = p().pos.x + f.x * 110, z = p().pos.z + f.z * 110;
      game.respawnPlayer({ x, y: surfaceY(game.world, x, z), z, heading: new THREE.Euler().setFromQuaternion(p().quat, "YXZ").y });
      next(new URLSearchParams(window.location.search).get("from") === "quad" ? "quad" : "compile"); // &from=quad: round-12 stages only
    },
    compile() {
      const c = compileDesign(wreckframeDesign()), m = c.mech;
      ok("Wreckframe compiles with a core", m && m.core);
      ok("Two legs, walker can stand", m && m.legs === 2 && m.walker.ok, m && m.legs);
      ok("Reactor carries it", m && !m.walker.overloaded, m && m.walker.pw);
      const d = normalizeDesign(presetByName("Jackal")), a = addPart(d, "block", [1, 1, 0], {});
      ok("Symmetry places a twin", a.ids.length === 2);
      const h = createHistory(); h.push(d); ok("Undo restores", JSON.stringify(h.undo(a.design)) === JSON.stringify(d));
      const back = decodeDesign(encodeDesign(wreckframeDesign()));
      ok("Share code keeps the free build", JSON.stringify(back.free) === JSON.stringify(wreckframeDesign().free));
      dataChecks(game, ok);
      ok("Spawned and folding", game.mech.rideWreckframe(true), game.onfoot.hud().zone ? "in a safe zone" : "open road");
      next("fold");
    },
    fold() {
      if (st().tr && t < 3) return;
      ok("Folded into Walker mode", p().walking && st().k === 1, st().k);
      ok("Hit box stands up", p().chassis.hit.half[1] > 2, p().chassis.hit.half[1]);
      mark = p().pos.clone(); st().test = { fwd: 1, turn: 0, strafe: 0, run: false, jump: false, t: 2 };
      next("walk");
    },
    walk() {
      if (t < 2.1) return;
      const d = Math.hypot(p().pos.x - mark.x, p().pos.z - mark.z);
      ok("Walks forward", d > 2, d.toFixed(1) + " m");
      ok("Footsteps and footprints", st().steps > 0 && game.mech.prints.total() > 0, st().steps);
      const g = game.world.groundAt(p().pos.x, p().pos.z, p().pos.y + 2);
      ok("Stands at hip height", Math.abs(p().pos.y - g - st().stance) < 0.4, (p().pos.y - g).toFixed(2));
      mark = st().yaw; st().test = { fwd: 0, turn: 1, strafe: 0, run: false, jump: false, t: 0.8 };
      next("turn");
    },
    turn() {
      if (t < 0.9) return;
      ok("Turns", Math.abs(st().yaw - mark) > 0.5, (st().yaw - mark).toFixed(2));
      st().test = { fwd: 0, turn: 0, strafe: 0, run: false, jump: true, t: 0.3 }; mark = false;
      next("jump");
    },
    jump() {
      if (st().air) mark = true;
      if (t < 1.6) return;
      ok("Jumps and lands", mark && !st().air);
      mark = shots();
      next("fire");
    },
    fire() {
      p().ctl.fire = true; // mech.step runs after the player's controls and before combat.fire
      if (t < 0.5) return;
      ok("Fires in Walker mode", shots() > mark, shots() - mark + " shots");
      st().keys.press(1);
      next("pose");
    },
    pose() {
      if (t < 0.8) return;
      ok("Key 1 blends the Guard pose", Math.abs((st().pose[13] || 0) - 0.9) < 0.15, (st().pose[13] || 0).toFixed(2));
      st().keys.press(1); st().punchReq = true;
      next("punch");
    },
    punch() {
      if (t < 0.2) return;
      ok("Ram fist punches", st().fistCd > 0);
      ok("Folds back", game.mech.toggle() === "");
      next("unfold");
    },
    unfold() {
      if (st().tr && t < 3) return;
      ok("Back in Drive mode", !p().walking && st().k === 0);
      next("drive");
    },
    drive() {
      if (t < 1) return;
      const g = game.world.groundAt(p().pos.x, p().pos.z, p().pos.y + 2);
      ok("Car physics resume", p().pos.y - g < 3 && p().pos.y - g > 0, (p().pos.y - g).toFixed(2));
      next("quad");
    },
    ...moreStages({ ok, st, p, next, t: () => t, finish, game }),
    done() {},
  };
  function finish() {
    ok("No script errors", r.errors === 0, r.errors ? r.errors + " · " + r.lastError : 0);
    r.pass = r.items.every((x) => x.ok); r.done = true;
    local.setJSON("scrapwake.mechcheck", { ...r, at: Date.now() });
    next("done");
  }
  return (dt) => { t += dt; try { stages[r.stage](); } catch (e) { r.errors++; ok("Stage " + r.stage, false, e.message); r.done = true; next("done"); } };
}