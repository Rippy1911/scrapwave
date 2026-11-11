// Round-12 stages of ?mechcheck=1 (run after the Wreckframe stages): the four-legged Scuttler compiles, stands and
// walks; walker state packs and reads back for the network; a remote copy builds and stands; the gamepad chords map;
// a standing walker's feet sit on the ground (horde reach in arenas).
import { compileDesign } from "@/game/workshop/compile";
import { scuttlerDesign } from "@/game/mech/scuttler";
import { packMech, readMech, designForCode, applyRemoteMech } from "@/game/net/mechNet";
import { padMech } from "@/game/core/padMech";
import { placeVehicle, removeVehicle } from "@/game/vehicles/vehicle";

export function moreStages({ ok, st, p, next, t, finish, game }) {
  let mark = null;
  const packed = () => readMech(packMech({ parts: [] }, game));
  return {
    quad() {
      const m = compileDesign(scuttlerDesign()).mech;
      ok("Scuttler: four legs, can stand", m && m.core && m.legs === 4 && m.walker.ok, m && m.legs);
      ok("Scuttler reactor carries it", m && !m.walker.overloaded, m && m.walker.pw);
      if (!st()) game.mech.rideWreckframe(false); // started here with &from=quad: drive a Wreckframe for the pack test
      const r = packed();
      ok("Walker state packs for the net", r && r.code === 1 && r.mode === 0 && r.joints.length === st().rig.D.info.length, r && r.joints.length);
      const pad = (on) => (i) => on.includes(i), a = padMech(pad([4, 12, 2]), {}), b = padMech(pad([4, 3]), { 3: true });
      ok("Pad chords: LB+Up = key 1, LB+X = fist", a.held.has("Digit1") && a.edges.includes("punch") && !b.edges.includes("emote"));
      ok("Scuttler spawned", game.mech.rideScuttler(true));
      next("quadFold");
    },
    quadFold() {
      if (st().tr && t() < 3) return;
      ok("Scuttler stands up", p().walking && st().k === 1, st().k);
      mark = p().pos.clone(); st().test = { fwd: 1, turn: 0, strafe: 0, run: false, jump: false, t: 2 };
      next("quadWalk");
    },
    quadWalk() {
      if (t() < 2.1) return;
      const d = Math.hypot(p().pos.x - mark.x, p().pos.z - mark.z);
      ok("Scuttler walks", d > 1.5 && st().steps > 0, d.toFixed(1) + " m · " + st().steps + " steps");
      const g = game.world.groundAt(p().pos.x, p().pos.z, p().pos.y + 2);
      ok("Feet on the ground (horde reach)", Math.abs(p().pos.y - st().stance - g) < 0.6, (p().pos.y - st().stance - g).toFixed(2));
      const r = packed();
      ok("Net state: walker mode", r && r.code === 2 && r.mode === 1 && r.k === 1);
      const v = game.workshop.createDesigned(designForCode(r.code), { team: "remote", name: "Remote" });
      v.remote = true;
      placeVehicle(v, p().pos.x + 12, p().pos.y, p().pos.z, 0);
      game.vehicles.push(v);
      applyRemoteMech(game, v, r, 1);
      game.mech.frame();
      ok("Remote copy stands from net state", game.mech.state(v).k === 1 && v.chassis.hit.half[1] > 2, v.chassis.hit.half[1].toFixed(2));
      game.vehicles.splice(game.vehicles.indexOf(v), 1);
      removeVehicle(game, v);
      finish();
    },
  };
}