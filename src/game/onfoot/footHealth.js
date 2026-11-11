// The walker's health and what harms it: a car that touches them (dead at FOOT.killKmh and above, knocked down
// below it), a hard landing, a blast in range, a crowd's claws and shots. The bar is small and mends slowly when
// the walker is left alone. onDeath(cause) is called once, when the walker dies.
import { FOOT } from "@/game/onfoot/footGear";
import { WALK } from "@/game/onfoot/walker";

export function createFootHealth(game, walker, onDeath) {
  const h = { hp: FOOT.health, max: FOOT.health, down: 0, dead: false, cause: null, harmAt: -99, upAt: -99, fall: 0, grace: null, graceT: 0 };

  h.reset = () => Object.assign(h, { hp: h.max, down: 0, dead: false, cause: null, harmAt: -99, upAt: -99, fall: 0, grace: null, graceT: 0 });
  h.canAct = () => !h.dead && h.down <= 0;
  h.kill = (cause) => {
    if (h.dead) return false;
    Object.assign(h, { hp: 0, dead: true, down: 0, cause });
    onDeath(cause);
    return true;
  };
  h.hurt = (dmg, cause) => {
    if (h.dead || !(dmg > 0)) return false;
    h.harmAt = game.time;
    h.hp -= dmg; // the HUD's red edge reads harmAt; the "hit" event is the marker for hits you land
    if (h.hp <= 0) h.kill(cause);
    return true;
  };
  h.knock = (t = FOOT.knockTime) => {
    if (h.dead) return;
    h.down = t;
    walker.vel.x = 0; walker.vel.z = 0;
    game.emit({ type: "minor", text: "KNOCKED DOWN" });
  };
  // The car you just left may still be rolling: for a moment it cannot run you over.
  h.leftCar = (v) => { h.grace = v; h.graceT = 2; };

  // What this car would do to the walker right now: "kill", "knock" or null. v: pos, vel, quat, chassis.hit.
  h.touch = (v) => {
    const [hx, hy, hz] = v.chassis.hit.half, c = v.chassis.hit.center, m = WALK.radius + 0.3;
    const l = walker.pos.clone().sub(v.pos).applyQuaternion(v.quat.clone().invert());
    if (Math.abs(l.x - c[0]) > hx + m || Math.abs(l.z - c[2]) > hz + m || l.y > c[1] + hy || l.y + 1.7 < c[1] - hy) return null;
    const sp = Math.hypot(v.vel.x, v.vel.z), dx = walker.pos.x - v.pos.x, dz = walker.pos.z - v.pos.z, dl = Math.hypot(dx, dz) || 1;
    if (sp * 3.6 < FOOT.knockKmh || (v.vel.x * dx + v.vel.z * dz) / (dl * sp) < 0.2) return null; // parked, or driving away
    return sp * 3.6 >= FOOT.killKmh ? "kill" : "knock";
  };
  h.contact = (v) => {
    const what = h.touch(v);
    if (what === "kill") h.kill("run over");
    else if (what === "knock" && h.down <= 0 && game.time - h.upAt > 0.6) h.knock();
    return what;
  };

  h.step = (dt) => {
    if (h.dead) return;
    if (h.down > 0) { h.down -= dt; if (h.down <= 0) h.upAt = game.time; }
    h.graceT -= dt;
    // Falls: the fastest drop seen in the air is paid on landing.
    if (!walker.grounded) h.fall = Math.min(h.fall, walker.vel.y);
    else if (h.fall < 0) {
      const s = -h.fall;
      h.fall = 0;
      if (s >= FOOT.fallKill) h.kill("fall");
      else if (s > FOOT.fallSafe) h.hurt(((s - FOOT.fallSafe) / (FOOT.fallKill - FOOT.fallSafe)) * h.max, "fall");
    }
    if (h.dead) return;
    for (const v of game.vehicles) {
      if (!v.mesh.root.parent || v.air || (v === h.grace && h.graceT > 0)) continue;
      if (v.pos.distanceToSquared(walker.pos) > 144) continue;
      if (h.contact(v) === "kill") return;
    }
    if (h.hp < h.max && game.time - h.harmAt > FOOT.regenDelay) h.hp = Math.min(h.max, h.hp + FOOT.regen * dt);
  };

  // An explosion: anywhere inside its radius kills.
  h.blast = (pos, radius) => {
    if (h.dead) return false;
    const d = Math.hypot(pos.x - walker.pos.x, pos.y - (walker.pos.y + 0.9), pos.z - walker.pos.z);
    return d <= radius ? h.kill("blast") : false;
  };
  return h;
}