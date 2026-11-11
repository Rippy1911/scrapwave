// Traps: the rear drop slot (G drops, H cycles) with oil slicks, spike strips and mines, plus the world's oil
// spots. Oil: cars that cross it lose most grip for a moment and tend to spin; fire or a blast lights it for
// about 6 s (fire damage to cars crossing). Spikes pop tyres: grip and top speed drop until repaired at an
// outpost or by a repair crate. Mines share the combat code. Effects run in the controller layer (control).
import * as THREE from "three";
import { TRAP_TIERS, TRAP_NAMES } from "@/game/traps/tiers";
import { slot, refill, cycleKind, hasSlot, vehicleTier, atOutpost } from "@/game/traps/charges";
import { setGrip, releaseGrip, spinKick, flatLimit } from "@/game/traps/grip";
import { makeSlickMesh, animateSlick } from "@/game/traps/slickMesh";
import { makeSpikeMesh } from "@/game/traps/spikeMesh";
import { resolveOilSpots } from "@/game/traps/oilSpots";
import { createAiTraps } from "@/game/traps/aiTraps";
import { createTrapShop } from "@/game/traps/shop";
import { applyDamage } from "@/game/net/damage";

const back = new THREE.Vector3(), fwd = new THREE.Vector3(), rel = new THREE.Vector3();
const SPOT = { ...TRAP_TIERS[1].oil, grip: 0.2, regrow: 40 };

export function createTraps(game) {
  const slicks = [], strips = [];
  let outpostT = 0;

  function addSlick(o) {
    const y = game.world.groundAt(o.x, o.z, (o.y ?? 50) + 1);
    const s = { burnT: 0, burnt: false, age: 0, ...o, y, mesh: makeSlickMesh(game.scene, o.x, y, o.z, o.r) };
    slicks.push(s);
    return s;
  }
  for (const p of resolveOilSpots(game)) addSlick({ ...SPOT, ...p, life: Infinity, permanent: true, owner: null });

  function behind(v, dist) {
    fwd.set(0, 0, -1).applyQuaternion(v.quat).setY(0).normalize();
    return back.copy(v.pos).addScaledVector(fwd, -(v.chassis.hit.half[2] + dist));
  }

  // Drop the selected (or given) trap behind the car. Returns true when one was laid.
  function drop(v, kind = null) {
    if (!v || !v.alive || !hasSlot(v)) return false;
    const st = slot(game, v), k = kind || st.sel;
    if (!(st.charges[k] > 0) || st.cd > 0) return false;
    const tier = TRAP_TIERS[vehicleTier(game, v)];
    if (k === "oil") { const t = tier.oil, p = behind(v, t.r * 0.7); addSlick({ ...t, x: p.x, z: p.z, y: v.pos.y, owner: v }); }
    else if (k === "spikes") {
      const t = tier.spikes, p = behind(v, 1.6);
      const y = game.world.groundAt(p.x, p.z, v.pos.y + 1), yaw = Math.atan2(fwd.x, fwd.z);
      strips.push({ ...t, x: p.x, y, z: p.z, yaw, owner: v, hit: new Set(), mesh: makeSpikeMesh(game.scene, game.M, p.x, y, p.z, yaw, t.len) });
    } else if (k === "mines") game.combat.dropMine(v, tier.mines);
    else return false;
    st.charges[k]--; st.cd = 0.7;
    if (v === game.player) { game.audio.clank(); game.emit({ type: "minor", text: `${TRAP_NAMES[k].toUpperCase()} DROPPED · ${st.charges[k]} LEFT` }); }
    return true;
  }

  function light(s) { if (!(s.burnT > 0) && !s.burnt) { s.burnT = s.burn; if (s.permanent) s.regrowT = SPOT.regrow; } }
  function ignite(o, d, range) {
    for (const s of slicks) {
      rel.set(s.x - o.x, s.y - o.y, s.z - o.z);
      const t = rel.dot(d);
      if (t > 0 && t < range && rel.lengthSq() - t * t < (s.r + 1) ** 2) light(s);
    }
  }
  function blast(pos, radius) { for (const s of slicks) if (Math.hypot(s.x - pos.x, s.z - pos.z) < radius + s.r && Math.abs(s.y - pos.y) < radius + 2) light(s); }

  function onCar(v, dt) {
    if (v.remote) return;
    if (!v.alive) { releaseGrip(v); return; }
    let grip = 1, oil = null;
    for (const s of slicks) {
      if (s.burnt && !(s.burnT > 0)) continue;
      if (Math.hypot(v.pos.x - s.x, v.pos.z - s.z) > s.r * 0.95 || Math.abs(v.pos.y - s.y) > 2.5) continue;
      oil = s;
      if (s.burnT > 0) { applyDamage(game, v, s.burnDps * dt, v.pos, s.owner, { splash: true, weapon: "flamer" }); v.burn = Math.max(v.burn || 0, 1.5); v.burnBy = s.owner; }
      else if (v.burn > 0) light(s);
    }
    if (oil && v.contacts > 0) { if (!v.onOil) spinKick(v, oil.spin); v.oilT = oil.hold; v.oilGrip = oil.grip; }
    v.onOil = !!oil;
    if (v.oilT > 0) { v.oilT -= dt; grip = Math.min(grip, v.oilGrip); }
    for (const s of strips) {
      if (s.owner === v || s.hit.has(v) || Math.abs(v.pos.y - s.y) > 2) continue;
      const dx = v.pos.x - s.x, dz = v.pos.z - s.z, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      if (Math.abs(dx * c - dz * sn) > s.len / 2 + 0.8 || Math.abs(dx * sn + dz * c) > 1.5) continue;
      s.hit.add(v);
      v.flat = { grip: s.grip, top: s.top, slowT: s.slow };
      game.particles.sparks(v.pos.x, v.pos.y, v.pos.z, 14);
      if (v === game.player) game.callout("TYRES POPPED", "repair at an outpost", "#ff8a3a");
      else if (s.owner === game.player) game.emit({ type: "minor", text: `SPIKED ${v.name || ""}`.trim() });
    }
    if (v.flat) { grip = Math.min(grip, v.flat.grip); flatLimit(v, v.flat, dt); }
    if (grip < 1) setGrip(v, grip); else releaseGrip(v);
  }

  function outposts() {
    for (const v of game.vehicles) {
      if (v.remote || !v.alive || !atOutpost(game, v)) continue;
      const fixed = !!v.flat;
      v.flat = null;
      const added = refill(game, v);
      if (v === game.player && (fixed || added)) game.emit({ type: "minor", text: fixed ? "TYRES FIXED · TRAPS RESTOCKED" : "TRAPS RESTOCKED" });
    }
  }

  const ai = createAiTraps(game, { drop, slicks, strips });
  const shop = createTrapShop(game, { refill });

  function control(dt) {
    const p = game.player, inp = game.input;
    const can = p.alive && !p.air && !game.uiOpen && !(game.introT > 0) && !game.buildView.active && !game.autopilot && !game.demo.running;
    if (inp.edge("trapDrop") && can) drop(p);
    if (inp.edge("trapCycle") && can && hasSlot(p)) { const k = cycleKind(game, p); game.emit({ type: "minor", text: `TRAP: ${TRAP_NAMES[k].toUpperCase()} · ${slot(game, p).charges[k]} LEFT` }); }
    if (inp.edge("trapShop") && can) shop.buy(p);
    for (let i = slicks.length - 1; i >= 0; i--) {
      const s = slicks[i];
      s.age += dt; s.life -= dt;
      if (s.burnT > 0) { s.burnT -= dt; if (s.burnT <= 0) { s.burnt = true; if (!s.permanent) s.life = Math.min(s.life, 1.5); } }
      if (s.permanent && s.burnt && (s.regrowT -= dt) <= 0) s.burnt = false;
      if (s.life <= 0) { s.mesh.removeFromParent(); s.mesh.material.dispose(); slicks.splice(i, 1); }
    }
    for (let i = strips.length - 1; i >= 0; i--) if ((strips[i].life -= dt) <= 0) { strips[i].mesh.removeFromParent(); strips.splice(i, 1); }
    for (const v of game.vehicles) { onCar(v, dt); if (v.trapSt) v.trapSt.cd = Math.max(0, v.trapSt.cd - dt); }
    if ((outpostT -= dt) <= 0) { outpostT = 1; outposts(); }
    ai.step(dt);
  }

  function frame(dt) { for (const s of slicks) animateSlick(game, s, dt); }

  function clearDropped() {
    for (let i = slicks.length - 1; i >= 0; i--) if (!slicks[i].permanent) { slicks[i].mesh.removeFromParent(); slicks.splice(i, 1); }
    for (const s of strips) s.mesh.removeFromParent();
    strips.length = 0;
  }

  function hud() {
    const p = game.player;
    if (!hasSlot(p)) return null;
    const st = slot(game, p);
    return { sel: st.sel, charges: { ...st.charges }, tier: TRAP_TIERS[vehicleTier(game, p)].name, shop: shop.offer(p), flat: !!p.flat };
  }

  function list() {
    const r = (n) => Math.round(n * 10) / 10;
    return [
      ...slicks.map((s) => ({ kind: s.permanent ? "oilSpot" : "oil", x: r(s.x), z: r(s.z), r: r(s.r), burning: s.burnT > 0, life: s.permanent ? null : r(s.life), owner: s.owner ? s.owner.id : null })),
      ...strips.map((s) => ({ kind: "spikes", x: r(s.x), z: r(s.z), len: s.len, life: r(s.life), owner: s.owner ? s.owner.id : null, hits: s.hit.size })),
      ...game.combat.mines.map((m) => ({ kind: "mine", x: r(m.mesh.position.x), z: r(m.mesh.position.z), dmg: m.dmg, armed: m.arm <= 0, owner: m.owner ? m.owner.id : null })),
    ];
  }

  game.traps = { drop, ignite, blast, light, control, frame, hud, list, clearDropped, refill: (v) => refill(game, v), slot: (v) => slot(game, v), cycle: (v) => cycleKind(game, v), shop, slicks, strips };
  return game.traps;
}