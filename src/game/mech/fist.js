// Ram fist: fire (J / left mouse) throws a punch. The fist joint slides out, and a moment later the knuckles hit
// what is in front: cars take the blow and get shoved, horde figures go down, base walls take damage.
import * as THREE from "three";
import { applyDamage } from "@/game/net/damage";
import { applyImpulse } from "@/game/vehicles/physics";

const PUNCH = 0.38, HIT_AT = 0.13;
const o = new THREE.Vector3(), d = new THREE.Vector3(), push = new THREE.Vector3();

// Extension of the fist joints right now (0..1 of their travel), for the rig.
export const punchK = (st) => (st.punch ? Math.sin(Math.PI * Math.min(1, st.punch.t / PUNCH)) : 0);

export function fistStep(game, v, st, dt) {
  const fists = st.rig.D.fists;
  if (!fists.length) return;
  st.fistCd = Math.max(0, (st.fistCd || 0) - dt);
  const w = v.weapons.find((x) => x.def.kind === "fist" && !x.disabled);
  if (!w) return;
  if (!st.punch && (v.ctl.fire || st.punchReq) && st.fistCd <= 0 && v.alive) {
    st.punch = { t: 0, hit: false }; st.fistCd = w.def.reload; st.punchReq = false;
    game.audio.shot("harpoon", v.pos, v === game.player);
  }
  const p = st.punch;
  if (!p) return;
  p.t += dt;
  if (!p.hit && p.t >= HIT_AT) { p.hit = true; strike(game, v, st, w.def); }
  if (p.t >= PUNCH) st.punch = null;
}

function strike(game, v, st, def) {
  const obj = st.rig.objOf(st.rig.D.fists[0].mount);
  if (obj) obj.getWorldPosition(o); else o.copy(v.pos);
  d.set(0, 0, -1).applyQuaternion(v.quat);
  o.addScaledVector(d, -1.2); // start just behind the knuckles so a car right against them is hit
  const r = game.combat.ray(o, d, def.range + 1.2, v);
  game.particles.sparks(r.point.x, r.point.y, r.point.z, r.v || r.fig || r.box ? 10 : 3);
  if (r.v) {
    applyDamage(game, r.v, def.dmg, r.point, v, { weapon: "ramFist" });
    push.copy(d).setY(0.35).normalize().multiplyScalar(r.v.mass * def.push);
    if (!r.v.remote) applyImpulse(r.v, r.point, push);
    game.audio.impact(r.point, 1.4); game.shake(r.point, 0.5);
  } else if (r.fig) game.horde.kill(r.fig, v);
  else if (r.world && r.box && r.box.mod && game.base) { game.base.hitBox(r.box, def.dmg, v, r.point); game.audio.impact(r.point, 1.2); }
  else if (r.prop) game.world.props.kill(r.prop);
}