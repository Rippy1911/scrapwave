// Remote vehicles: other humans (and the host's AI on non-host browsers). Snapshots are buffered and played
// ~120 ms behind server time with interpolation (short extrapolation when late). Bodies are kinematic;
// wheels, suspension, steering, turrets, turbo and exhaust are derived from the motion.
import * as THREE from "three";
import { AI, VEHICLES } from "@/game/data/tuning";
import { DRIFTERS, TIER_NAME, TIER_COLOR } from "@/game/data/drifters";
import { RATTLER_PAINT } from "@/game/data/vehicles";
import { createVehicle, placeVehicle, removeVehicle, detachPart, wreckVehicle } from "@/game/vehicles/vehicle";
import { createNameTag, redrawNameTag } from "@/game/vehicles/nametag";
import { decodePaint, aimFrom } from "@/game/net/codec";
import { cosmetic } from "@/game/net/damage";
import { readFoot } from "@/game/onfoot/footNet";
import { FACTION } from "@/game/factions/roster";
import { readMech, designForCode, detachedOf, applyRemoteMech } from "@/game/net/mechNet";
import { readRide, rideKey, showDesign } from "@/game/net/rideNet";
import { fitWings } from "@/game/vehicles/wingFlight";

const KEEP = 24, DELAY = 120, EXTRA = 250, HUMAN = ["jackal", "brawler", "mammoth"];
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const up = new THREE.Vector3(), fwd = new THREE.Vector3(), hub = new THREE.Vector3(), anc = new THREE.Vector3();
const lerp = (a, b, k) => a + (b - a) * k;

export function createRemotes(game) {
  const ents = new Map(), infos = new Map();
  let offset = null;
  const serverNow = () => performance.now() + (offset || 0);

  function optsFor(e, s) {
    if (!e.ai) {
      const info = infos.get(e.id) || {}, dec = decodePaint(info.paint), tier = dec.armour;
      return { chassis: HUMAN.includes(info.vehicle) ? info.vehicle : "jackal", o: { team: "remote", name: info.name || "Driver", paint: dec.paint, paint2: "#3a3734", loadout: dec.loadout || undefined, armour: tier ? { front: tier, rear: tier, left: tier, right: tier, top: tier } : undefined } };
    }
    if (s.kind === "militia") { // id "am-<faction>-<k>" (factions/militia.js)
      const f = FACTION[String(e.id).split("-")[1]] || FACTION.well;
      return { chassis: VEHICLES[s.vehicle] ? s.vehicle : "buggy", militia: f, o: { team: "militia", name: s.name || "Guard", paint: f.paint, paint2: "#d9d2c0", skill: AI.skills.veteran } };
    }
    const team = ["rattler", "cisterner", "warlord"].includes(s.kind) ? s.kind : "drifter";
    const chassis = VEHICLES[s.vehicle] ? s.vehicle : team === "drifter" && DRIFTERS.find((x) => x.name === s.name) ? DRIFTERS.find((x) => x.name === s.name).chassis : "buggy";
    if (team === "cisterner") return { chassis, o: { team, name: s.name || "Cistern", paint: "#5f7f86", paint2: "#d9d2c0", hull: chassis === "tanker" ? 900 : undefined, skill: AI.skills.veteran } };
    if (team === "warlord") return { chassis, o: { team, name: "The Warlord", paint: "#3b302a", paint2: "#e6dfcc", hull: 4000, skill: AI.skills.ace } };
    const d = team === "drifter" ? DRIFTERS.find((x) => x.name === s.name) : null;
    return { chassis, d, o: { team, name: s.name || "Drifter", paint: d ? d.paint : RATTLER_PAINT, paint2: d ? d.paint2 : "#b23a1f", loadout: d ? { ...d.loadout } : undefined, skill: AI.skills[d ? d.skill : "veteran"] } };
  }

  function build(e, s) {
    const { chassis, o, d, militia } = optsFor(e, s);
    const m = e.ai ? null : readMech(s); // a human driving a moving machine: build that machine
    const r = e.ai ? null : readRide(s), sd = r && !m ? showDesign(r.show) : null; // a showcase vehicle, wings
    const v = m ? game.workshop.createDesigned(designForCode(m.code), o) : sd ? game.workshop.createDesigned(sd, o) : createVehicle(game, chassis, o);
    if (r && r.wings) fitWings(game, v, r.wings); // no-op when the design brought its own wings
    e.rideKey = r ? rideKey(r) : "";
    e.mechCode = m ? m.code : 0;
    v.remote = true; v.netId = e.id; v.spreadMul = 1;
    v.skillName = e.ai ? (d ? TIER_NAME[d.skill] : militia ? "Militia" : "Rattler") : "Human";
    if (militia) { v.faction = militia.id; createNameTag(game, v, o.name, militia.color, true, "MILITIA"); }
    else if (!e.ai) {
      const info = infos.get(e.id) || {}, dec = decodePaint(info.paint);
      const sub = dec.title || "";
      createNameTag(game, v, o.name, "#f2c230", false, sub);
      if (dec.emblem) redrawNameTag(v, { avatar: { ...dec.emblem, color: dec.paint, color2: "#1a1410" } });
    }
    else if (o.team === "drifter") createNameTag(game, v, o.name, TIER_COLOR[d ? d.skill : "veteran"], true, v.skillName);
    else if (o.team === "cisterner") { game.decorateCisterner?.(v); createNameTag(game, v, o.name, "#9cc8ff", true, chassis === "tanker" ? "WATER" : "ESCORT"); }
    else if (o.team === "warlord") { game.decorateWarlord?.(v); createNameTag(game, v, "THE WARLORD", "#ff4a2a", true, "4000 HP"); }
    placeVehicle(v, s.x, s.y, s.z, 0);
    v.quat.set(s.qx, s.qy, s.qz, s.qw).normalize(); v.prevQuat.copy(v.quat);
    game.vehicles.push(v);
    e.v = v; e.rebuild = false;
  }

  function drop(e) {
    const v = e.v;
    e.v = null;
    if (!v) return;
    const i = game.vehicles.indexOf(v);
    if (i >= 0) { game.vehicles.splice(i, 1); removeVehicle(game, v); }
  }

  function push(id, ai, s, t) {
    let e = ents.get(id);
    if (!e) ents.set(id, (e = { id, ai, buf: [], v: null, seen: 0, wrecks: 0, banked: 0 }));
    const last = e.buf[e.buf.length - 1];
    if (last && last.t >= t) return;
    e.buf.push({ ...s, t });
    if (e.buf.length > KEEP) e.buf.shift();
    e.seen = performance.now();
  }

  function pose(e, T, dt) {
    const b = e.buf, v = e.v;
    let a = b[b.length - 1], c = a, k = 0, ext = 0;
    if (T >= a.t) ext = Math.min(T - a.t, EXTRA) / 1000;
    else if (T <= b[0].t) { a = c = b[0]; }
    else for (let i = 0; i < b.length - 1; i++) if (b[i].t <= T && b[i + 1].t > T) { a = b[i]; c = b[i + 1]; k = (T - a.t) / (c.t - a.t); break; }
    v.vel.set(lerp(a.vx || 0, c.vx || 0, k), lerp(a.vy || 0, c.vy || 0, k), lerp(a.vz || 0, c.vz || 0, k));
    v.pos.set(lerp(a.x, c.x, k), lerp(a.y, c.y, k), lerp(a.z, c.z, k)).addScaledVector(v.vel, ext);
    qa.set(a.qx, a.qy, a.qz, a.qw).normalize(); qb.set(c.qx, c.qy, c.qz, c.qw).normalize();
    v.quat.slerpQuaternions(qa, qb, k);
    v.steer = lerp(a.steer || 0, c.steer || 0, k);
    v.turboActive = !!c.turbo && v.alive;
    if (typeof c.hull === "number") v.hull = c.hull;
    const f = c.flags || 0, ctl = v.ctl;
    ctl.throttle = c.thr || 0;
    ctl.fire = v.alive && !!(f & 2); ctl.rockets = v.alive && !!(f & 4); ctl.harpoon = v.alive && !!(f & 8);
    aimFrom(v, c.aimYaw || 0, c.aimPitch || 0);
    v.hitMeT = Math.max(0, (v.hitMeT || 0) - dt);
    v.lockTarget = v.hitMeT > 0 ? game.player : null;
    v.aiming = v.hitMeT > 0;
    return c;
  }

  // Another player on foot (onfoot/footNet.js): their car is parked, their scavenger walks beside it.
  function footFrom(e, c) {
    const walkers = game.onfoot && game.onfoot.remote;
    if (!walkers) return;
    const f = e.v.alive ? readFoot(c, e.v.pos, game.world) : null;
    if (!f) { if (e.onFoot) { walkers.apply(e.id, { gone: 1 }); e.onFoot = false; } return; }
    e.v.steer = 0; e.v.ctl.throttle = 0; e.v.vel.set(0, 0, 0);
    walkers.apply(e.id, f);
    e.onFoot = true;
  }

  function wheels(v) {
    const C = v.chassis;
    up.set(0, 1, 0).applyQuaternion(v.quat); fwd.set(0, 0, -1).applyQuaternion(v.quat);
    const sp = v.vel.dot(fwd);
    let n = 0;
    C.wheels.forEach((wd, i) => {
      const st = v.wheelState[i];
      hub.set(wd.pos[0], wd.pos[1], wd.pos[2]).applyQuaternion(v.quat).add(v.pos);
      anc.copy(hub).addScaledVector(up, C.susLen * 0.5);
      const L = (anc.y - game.world.groundAt(anc.x, anc.z, anc.y)) / Math.max(0.35, up.y) - wd.r;
      st.contact = L < C.susLen;
      st.comp = st.contact ? Math.min(C.susLen, C.susLen - L) : 0;
      st.spin = sp / wd.r;
      if (st.contact) n++;
    });
    v.contacts = n; v.grounded = n >= 2; v.sliding = 0;
    if (v.alive && v.ctl.throttle > 0.4 && Math.random() < 0.2) {
      anc.set(0, 0.3, C.hit.half[2]).applyQuaternion(v.quat).add(v.pos);
      game.particles.smoke(anc.x, anc.y, anc.z, false, 0.6);
    }
  }

  function syncParts(e, s) {
    const v = e.v, parts = detachedOf(s);
    if (!v.alive) return;
    for (const id of parts) {
      const pt = v.mesh.parts.find((p) => String(p.id) === String(id) && !p.detached);
      if (pt) cosmetic(game, () => detachPart(game, v, pt, null));
    }
    if (!(s.flags & 1)) cosmetic(game, () => wreckVehicle(game, v, null));
    else if (parts.length < v.mesh.parts.filter((p) => p.detached).length) e.rebuild = true; // repaired in town
  }

  return {
    ingest(m, myId, isHost) {
      const est = m.now - performance.now();
      offset = offset === null || Math.abs(est - offset) > 1000 ? est : offset + (est - offset) * 0.05;
      const keep = game.netFilter || (() => true); // a lobby arena match shows only its own players (lobby/match.js)
      for (const [id, s] of Object.entries(m.players || {})) if (id !== myId && keep(id, false)) push(id, false, s, m.now);
      if (!isHost) for (const s of m.ai || []) if (keep(s.id, true)) push(s.id, true, s, m.now);
    },
    step(dt) {
      const T = serverNow() - DELAY;
      for (const e of [...ents.values()]) {
        if (performance.now() - e.seen > 3000) { drop(e); ents.delete(e.id); continue; }
        const s = e.buf[e.buf.length - 1];
        if (!s) continue;
        const alive = !!(s.flags & 1), inWorld = e.v && game.vehicles.includes(e.v);
        if (!e.v || e.rebuild || (alive && (!inWorld || !e.v.alive))) { drop(e); build(e, s); }
        else if (!inWorld) continue;
        const c = pose(e, T, dt);
        if (!e.ai) footFrom(e, c);
        const m = e.ai ? null : readMech(c);
        if ((m ? m.code : 0) !== (e.mechCode || 0) || (!e.ai && rideKey(readRide(s)) !== e.rideKey)) e.rebuild = true; // got into or out of a machine, a showcase ride or a winged car
        else if (m) { applyRemoteMech(game, e.v, m, dt); e.v.walking = m.k >= 0.5; }
        wheels(e.v);
        syncParts(e, c);
      }
    },
    setInfo(id, info) {
      const old = infos.get(id);
      infos.set(id, info);
      const e = ents.get(id);
      if (e && old && (old.vehicle !== info.vehicle || old.paint !== info.paint)) e.rebuild = true;
    },
    remove(id) { const e = ents.get(id); if (e) { drop(e); ents.delete(id); } },
    find(id) { const e = ents.get(id); return e ? e.v : null; },
    entry: (id) => ents.get(id),
    name: (id) => (infos.get(id) || {}).name || "Driver",
    humans() { return [...ents.values()].filter((e) => !e.ai).map((e) => ({ id: e.id, name: this.name(e.id), vehicle: (VEHICLES[(infos.get(e.id) || {}).vehicle] || VEHICLES.jackal).name, alive: !!(e.v && e.v.alive), wrecks: e.wrecks, banked: e.banked })); },
    // Hand the host's AI over to local brains (this browser became host).
    takeAi() {
      const out = [];
      for (const e of [...ents.values()]) if (e.ai) { if (e.v && game.vehicles.includes(e.v)) out.push(e.v); ents.delete(e.id); }
      return out;
    },
    count: () => ents.size,
    clear() { for (const e of ents.values()) drop(e); ents.clear(); infos.clear(); },
  };
}