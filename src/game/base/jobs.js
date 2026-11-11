// Radio jobs. The host offers one about every 70 s (online through `job` messages, kept by the server for late
// joiners); J accepts the oldest offer; at most two active. Each has a timer, a HUD card, a map marker and a payoff.
import * as THREE from "three";
import { JOBS } from "@/game/data/tuning";
import { PLACES } from "@/game/data/places";
import { net } from "@/game/net/net";
import { JOB_CATALOG, jobDef, countsFor } from "@/game/factions/jobCatalog";

// Round 11: every job belongs to a faction (factions/jobCatalog.js). The radio only offers jobs your standing
// allows; each faction's job board (the Trader menu) lists its own jobs, including rival ones.
const speaker = (k) => (jobDef(k) || {}).from || "Radio";
const TOWER = PLACES.find((p) => p.id === "tower"), REFINERY = PLACES.find((p) => p.id === "refinery");
const OFFER_TTL = 45;

export function createJobs(game) {
  const offers = [], active = [];
  let offerT = 25, seq = 0;
  const radio = (kind, text) => { game.emit({ type: "radio", from: speaker(kind), text }); game.audio.radio(); };
  const online = () => net.mode === "online";
  const allowed = (k) => !game.factions || game.factions.jobAllowed(k);
  const convoyOn = () => !!(game.convoy && game.convoy.active());
  const busy = (k) => active.some((a) => a.kind === k) || offers.some((o) => o.kind === k);

  function kinds() {
    return Object.keys(JOB_CATALOG).filter((x) => (!JOB_CATALOG[x].convoy || convoyOn()) && allowed(x) && !busy(x));
  }
  function addOffer(o) {
    if (offers.some((x) => x.id === o.id) || active.some((x) => x.id === o.id) || !allowed(o.kind)) return;
    offers.push({ ...o, until: game.time + OFFER_TTL });
    radio(o.kind, jobDef(o.kind).line + " Press L to take it.");
  }
  function offer() {
    const ks = kinds();
    if (!ks.length) return;
    const kind = ks[Math.floor(Math.random() * ks.length)];
    const id = `j${game.cycle.n}-${++seq}-${Math.floor(Math.random() * 1e4)}`;
    const o = { id, kind };
    if (online()) net.impl().sendEvent("job", o);
    addOffer(o);
  }

  // ---- objectives in the world (local to this player) ----
  function crateMesh(pos) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), game.M.hazard); b.position.y = 0.5; b.castShadow = true;
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 14, 12, 1, true), game.M.glow); glow.position.y = 7;
    g.add(b, glow); g.position.copy(pos); game.scene.add(g);
    return g;
  }
  function dumpModel(j) {
    const x = REFINERY.x + 38, z = REFINERY.z - 10, y = game.world.terrain.heightAt(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12), i === 1 ? game.M.hazard : game.M.rust);
      t.rotation.z = Math.PI / 2; t.position.set(0, 1.1 + (i === 1 ? 1.9 : 0), (i - 1) * (i === 1 ? 0 : 2.3)); t.castShadow = true; g.add(t);
    }
    game.scene.add(g);
    const box = game.world.colliders.add({ x, y: y + 1.6, z, hx: 1.4, hy: 1.6, hz: 3.4, tag: "dump" });
    box.onHit = (dmg, shooter) => { if (shooter === game.player && !game.cosmetic) hurtDump(j, dmg); };
    j.dump = { g, box, hp: 600, pos: new THREE.Vector3(x, y + 1, z) };
  }
  function hurtDump(j, dmg) {
    if (!j.dump || j.dump.hp <= 0) return;
    j.dump.hp -= dmg;
    game.particles.sparks(j.dump.pos.x, j.dump.pos.y + 1, j.dump.pos.z, 4);
    if (j.dump.hp <= 0) {
      game.combat.explode(j.dump.pos.clone(), 10, 120, game.player, 1.6);
      clearObjects(j);
      done(j);
    }
  }
  function clearObjects(j) {
    if (j.crate) { j.crate.removeFromParent(); j.crate = null; }
    if (j.dump) { j.dump.g.removeFromParent(); game.world.colliders.remove(j.dump.box); j.dump = null; }
  }

  function accept() {
    if (!offers.length || active.length >= JOBS.maxActive) return false;
    return start(offers.shift());
  }
  // A job taken straight off a faction's board.
  function takeKind(kind, fid) {
    const d = jobDef(kind);
    if (!d || (fid && d.faction !== fid) || !allowed(kind) || active.length >= JOBS.maxActive || active.some((a) => a.kind === kind)) return false;
    if (d.convoy && !convoyOn()) return false;
    const i = offers.findIndex((o) => o.kind === kind);
    return start(i >= 0 ? offers.splice(i, 1)[0] : { id: `b${game.cycle.n}-${++seq}`, kind });
  }
  function board(fid) {
    return Object.keys(JOB_CATALOG).map(jobDef).filter((d) => d.faction === fid).map((d) => ({
      kind: d.kind, title: d.title, reward: d.reward, from: d.from, need: d.need, rival: d.rival || null,
      locked: !allowed(d.kind), noConvoy: !!d.convoy && !convoyOn(), taken: active.some((a) => a.kind === d.kind),
    }));
  }
  function start(o) {
    const def = jobDef(o.kind);
    const j = { ...o, def, faction: def.faction, title: def.title, reward: def.reward, until: game.time + def.time, time: def.time, k: 0, held: 0, count: 0 };
    if (o.kind === "crash") { j.site = game.cycleSys.crashSite(); j.crate = crateMesh(j.site); }
    if (o.kind === "dump") dumpModel(j);
    active.push(j);
    game.callout("JOB TAKEN", def.title, "#9cc8ff");
    game.audio.radio();
    return true;
  }
  function done(j) {
    const i = active.indexOf(j);
    if (i < 0) return;
    active.splice(i, 1);
    clearObjects(j);
    game.player.scrap += j.reward;
    game.callout("JOB DONE", `+${j.reward} scrap · bank it`, "#7fe0a0");
    if (game.factions) game.factions.jobDone(j.kind);
    game.audio.bank();
    game.session.moments.push({ score: 30 + j.reward / 10, text: `Finished "${j.title}"` });
  }
  function fail(j, why) {
    const i = active.indexOf(j);
    if (i >= 0) active.splice(i, 1);
    clearObjects(j);
    game.callout("JOB FAILED", why, "#ff8a3a");
  }

  function home() {
    const p = game.base.mine();
    const rig = p && game.base.modules.rigOf(p.id);
    return rig ? new THREE.Vector3(rig.wx, rig.wy, rig.wz) : new THREE.Vector3(game.world.town.bank.x, 0, game.world.town.bank.z);
  }

  function progress(j, dt) {
    const p = game.player;
    if (j.kind === "tower") {
      if (p.alive && Math.hypot(p.pos.x - TOWER.x, p.pos.z - TOWER.z) < TOWER.r) j.held += dt;
      j.k = j.held / j.def.hold;
      if (j.k >= 1) done(j);
    } else if (j.def.mech === "count") {
      j.k = j.count / j.def.count;
      if (j.k >= 1) done(j);
    } else if (j.kind === "crash") {
      if (!j.carrying && j.crate && p.alive && p.pos.distanceTo(j.crate.position) < 7) { j.carrying = true; j.crate.visible = false; game.callout("CRATE ON BOARD", "haul it home", "#9cc8ff"); }
      if (j.carrying && !p.alive) { j.carrying = false; j.crate.position.copy(p.pos); j.crate.position.y = game.world.groundAt(p.pos.x, p.pos.z, 999); j.crate.visible = true; }
      if (j.crate) j.crate.children[0].rotation.y += dt;
      j.k = j.carrying ? 0.5 + 0.5 * Math.max(0, 1 - p.pos.distanceTo(home()) / Math.max(60, j.site.distanceTo(home()))) : 0;
      if (j.carrying && Math.hypot(p.pos.x - home().x, p.pos.z - home().z) < 25) done(j);
    } else if (j.def.mech === "escort") {
      const c = game.convoy;
      if (!c.active()) { if (c.arrived()) done(j); else fail(j, "the convoy is gone"); return; }
      j.k = c.progress();
    } else if (j.kind === "dump") j.k = j.dump ? 1 - j.dump.hp / 600 : 1;
  }

  function target(j) {
    if (j.kind === "tower") return { x: TOWER.x, z: TOWER.z };
    if (j.kind === "crash") return j.carrying ? home() : j.crate ? j.crate.position : null;
    if (j.kind === "dump") return j.dump ? j.dump.pos : null;
    if (j.def.mech === "escort") return game.convoy.lead();
    if (j.kind === "raid") return game.convoy.lead();
    return null;
  }

  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => {
    onWreck(v, attacker);
    if (attacker === game.player) for (const j of active) if (countsFor(j.def, v)) j.count++;
  };

  return {
    accept, takeKind, board, full: () => active.length >= JOBS.maxActive,
    step(dt) {
      if (game.input.edge("job")) accept();
      if (net.isHost() && game.cycleSys.phase() === "run") { offerT -= dt; if (offerT <= 0) { offerT = JOBS.offerEvery * (0.8 + Math.random() * 0.4); offer(); } }
      for (let i = offers.length - 1; i >= 0; i--) if (game.time > offers[i].until) offers.splice(i, 1);
      for (const j of [...active]) { if (game.time > j.until) { fail(j, "out of time"); continue; } progress(j, dt); }
    },
    blast(pos, radius, dmg, attacker) { for (const j of active) if (j.dump && attacker === game.player && j.dump.pos.distanceTo(pos) < radius + 3) hurtDump(j, dmg); },
    onNet(m) { if (m.done) { const i = offers.findIndex((o) => o.id === m.id); if (i >= 0) offers.splice(i, 1); } else if (m.kind && jobDef(m.kind)) addOffer({ id: m.id, kind: m.kind }); },
    sync(list) { for (const m of list) if (!m.done && m.kind && jobDef(m.kind)) addOffer({ id: m.id, kind: m.kind }); },
    reset() { for (const j of [...active]) clearObjects(j); active.length = 0; offers.length = 0; offerT = 25; },
    offerNow(kind) { const o = { id: `j${game.cycle.n}-${++seq}`, kind: jobDef(kind) ? kind : "hunt" }; if (online()) net.impl().sendEvent("job", o); addOffer(o); return o.id; },
    hud() {
      return {
        offer: offers[0] ? { title: jobDef(offers[0].kind).title, from: speaker(offers[0].kind), left: Math.ceil(offers[0].until - game.time), canTake: active.length < JOBS.maxActive } : null,
        active: active.map((j) => { const t = target(j); return { id: j.id, kind: j.kind, title: j.title, k: Math.min(1, j.k), left: Math.max(0, j.until - game.time), reward: j.reward, x: t ? t.x : null, z: t ? t.z : null, sub: j.def.mech === "count" ? `${j.count} / ${j.def.count}` : j.kind === "tower" ? `${Math.floor(j.held)} / ${j.def.hold} s` : j.kind === "crash" ? (j.carrying ? "deliver home" : "find the crate") : "" }; }),
      };
    },
    state: () => ({ offers: offers.map((o) => o.kind), active: active.map((j) => ({ kind: j.kind, k: Math.round(j.k * 100) / 100 })) }),
  };
}