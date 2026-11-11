// AI drivers and traps: drop one when a hostile is chasing close behind, and steer around traps they can see
// ahead (slicks, spike strips, armed mines that are not their own). Runs after the AI set ctl, before physics.
import * as THREE from "three";
import { hostile } from "@/game/ai/steer";
import { slot, hasSlot } from "@/game/traps/charges";

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), rel = new THREE.Vector3();
const LOOK = 24;

export function createAiTraps(game, { drop, slicks, strips }) {
  function chaser(v) {
    for (const t of game.vehicles) {
      if (t === v || !hostile(v, t)) continue;
      rel.subVectors(t.pos, v.pos);
      const d = rel.length();
      if (d > 40 || d < 3) continue;
      rel.divideScalar(d);
      if (rel.dot(fwd) > -0.55) continue; // not behind
      if (-t.vel.dot(rel) < 1.5) continue; // not closing in
      return { t, d };
    }
    return null;
  }

  function avoid(v) {
    let push = 0;
    const look = (x, z, r, owner) => {
      if (owner === v) return;
      rel.set(x - v.pos.x, 0, z - v.pos.z);
      const d = rel.length();
      if (d < 2 || d > LOOK) return;
      const along = rel.dot(fwd), lat = rel.dot(right);
      if (along / d < 0.6 || Math.abs(lat) > r + 1.8) return;
      push += (lat > 0 ? -1 : 1) * 0.8 * (1 - d / LOOK);
    };
    for (const s of slicks) if (!s.burnt || s.burnT > 0) look(s.x, s.z, s.r, s.permanent ? null : s.owner);
    for (const s of strips) look(s.x, s.z, s.len / 2, s.owner);
    for (const m of game.combat.mines) if (m.arm <= 0) look(m.mesh.position.x, m.mesh.position.z, 1.2, m.owner);
    if (push) v.ctl.steer = Math.max(-1, Math.min(1, v.ctl.steer + push));
  }

  function step(dt) {
    for (const v of game.vehicles) {
      if (v === game.player || v.remote || !v.alive || !v.mesh.root.parent) continue;
      fwd.set(0, 0, -1).applyQuaternion(v.quat).setY(0).normalize();
      right.set(1, 0, 0).applyQuaternion(v.quat).setY(0).normalize();
      if (v.vel.lengthSq() > 9) avoid(v);
      v.trapThink = (v.trapThink ?? Math.random()) - dt;
      if (v.trapThink > 0 || !hasSlot(v)) continue;
      v.trapThink = 0.5;
      if (v.vel.length() < 6 || Math.random() > 0.3) continue;
      const c = chaser(v);
      if (!c) continue;
      const st = slot(game, v);
      const order = c.d < 18 ? ["oil", "mines", "spikes"] : ["spikes", "mines", "oil"];
      const k = order.find((x) => st.charges[x] > 0);
      if (k && drop(v, k)) v.trapThink = 4 + Math.random() * 4;
    }
  }

  return { step };
}