// ?selfcheck=1 — scripted round-3 check through the same paths as window.scrapwake: empty the tank (limp mode),
// refill at a pump, grab a jerry can, play an instant replay (sim must not advance) and run the demo reel.
// Results: game.selfReport (debug overlay with &debug=1, and window.scrapwake.state().selfcheck).
import { surfaceY } from "@/game/world/spawn";

export function setupSelfCheck(game) {
  const r = game.selfReport = { stage: "drain", t: 0, limp: false, refill: false, jerry: false, replay: false, demo: false, errors: 0, pass: false, fail: false, note: "" };
  const onErr = () => { r.errors++; };
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onErr);
  game.autopilotCtl.set(true);
  r.st = { maxLimpThrottle: 0, at: 0 };
}

function parkAtPump(game) {
  const s = game.world.fuel.nearest(game.player.pos.x, game.player.pos.z);
  if (!s) return false;
  const x = s.x + Math.cos(s.yaw) * 2.6, z = s.z - Math.sin(s.yaw) * 2.6;
  game.respawnPlayer({ x, y: surfaceY(game.world, x, z), z, heading: s.yaw + Math.PI });
  return true;
}

function awayFromPump(game) {
  const s = game.world.fuel.nearest(game.player.pos.x, game.player.pos.z);
  const x = s.x + Math.sin(s.yaw) * 45, z = s.z + Math.cos(s.yaw) * 45;
  game.respawnPlayer({ x, y: surfaceY(game.world, x, z), z, heading: s.yaw + Math.PI });
}

export function selfCheckStep(game, dt) {
  const r = game.selfReport;
  if (!r || r.pass || r.fail) return;
  const p = game.player, st = r.st;
  r.t += dt; st.at += dt;
  const next = (stage) => { r.stage = stage; st.at = 0; };
  if (r.t > 75) { r.fail = true; r.note = `timed out in ${r.stage}`; game.callout("SELF-CHECK FAILED", r.note, "#ff4a2a"); return; }
  switch (r.stage) {
    case "drain":
      if (st.at < 0.5) return; // let the autopilot get rolling
      game.setFuel(p, 0); next("limp"); return;
    case "limp":
      if (p.limp) st.maxLimpThrottle = Math.max(st.maxLimpThrottle, p.ctl.throttle);
      if (st.at > 1) {
        r.limp = p.limp && st.maxLimpThrottle <= 0.3001 && !p.turboActive;
        game.autopilotCtl.set(false);
        if (!parkAtPump(game)) { r.fail = true; r.note = "no fuel station"; return; }
        game.setFuel(game.player, 45); next("refill");
      }
      return;
    case "refill":
      if (p.fuel >= p.fuelMax * 0.6) { r.refill = true; awayFromPump(game); next("jerry"); }
      return;
    case "jerry":
      if (st.at < 0.5) return;
      if (!st.can) { game.setFuel(p, 10); st.can = game.jerry.spawn(p.pos.x, p.pos.y - 0.5, p.pos.z); st.at = 0; return; }
      if (p.fuel > 30) { r.jerry = true; next("prereplay"); }
      else if (st.at > 3) { r.jerry = false; next("prereplay"); }
      return;
    case "prereplay": // a little footage of this car first
      if (st.at < 1.3) return;
      st.simT = game.time; r.replayStarted = game.replay.start(); setTimeout(() => game.replay.stop(), 1200); next("replay");
      return;
    case "replay":
      // Steps resume only after the replay ends; the sim clock must not have moved meanwhile.
      if (r.replayStarted && !game.replay.active) { r.replay = Math.abs(game.time - st.simT - dt) < 0.05; game.demo.start(); next("demo"); }
      else if (!r.replayStarted) { r.replay = false; game.demo.start(); next("demo"); }
      return;
    case "demo": {
      const s = game.demo.state();
      if (st.at > 1.5) {
        r.demo = s.running && s.t > 1 && s.shot !== "none";
        game.demo.stop();
        r.pass = r.limp && r.refill && r.jerry && r.replay && r.demo && r.errors === 0;
        r.fail = !r.pass;
        game.callout(r.pass ? "SELF-CHECK PASSED" : "SELF-CHECK FAILED", `${r.t.toFixed(0)} s · ${r.errors} errors`, r.pass ? "#7fe0a0" : "#ff4a2a");
      }
      return;
    }
    default:
  }
}