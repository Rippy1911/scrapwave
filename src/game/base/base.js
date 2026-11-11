// Bases: one code path offline and online. Every world action goes out through net.impl().sendEvent and the
// world changes only on the answer (the loopback net answers offline; the offline economy is kept here).
import * as THREE from "three";
import { BASE } from "@/game/data/tuning";
import { DRIFTERS } from "@/game/data/drifters";
import { net } from "@/game/net/net";
import { getDriverName } from "@/game/net/driver";
import { writeSave } from "@/game/core/save";
import { createPlots } from "@/game/base/plots";
import { createModules, moduleDef, footprint, MODULE_IDS } from "@/game/base/modules";
import { createTurrets } from "@/game/base/turrets";
import { createRaids } from "@/game/base/raids";
import { createUtility } from "@/game/base/utility";
import { createWorldHandlers } from "@/game/base/netWorld";
import { createAiBases } from "@/game/base/aiBases";
import { attachPieces } from "@/game/base/basePieces";
import { createBlueprints } from "@/game/base/blueprints";
import { createFortresses } from "@/game/base/fortress";
import { local } from "@/game/core/safeStorage";

const BP_KEY = "scrapwake-blueprint-v1";
const HALF = BASE.plotSize / 2;

export function createBase(game) {
  const base = { wallet: { bank: 0, banked: 0, plot: null, stash: 0 }, aiWallets: {}, claimed: new Set(), alert: null, lastAlert: -99, msg: null };
  game.base = base;
  game.selfId = () => net.myId();
  const plots = createPlots(game), modules = createModules(game);
  Object.assign(base, { plots, modules });
  const online = () => net.mode === "online";
  const send = (kind, data) => net.impl().sendEvent(kind, data);
  const me = () => game.selfId();

  base.mine = () => plots.list.find((p) => p.owner && p.owner.id === me()) || null;
  base.claimedThisCycle = (id) => base.claimed.has(id);
  base.isOwner = (plot, v) => !!(plot && plot.owner && v && (v === game.player ? plot.owner.id === me() : v.netId === plot.owner.id));
  base.ownerVehicle = (plot) => {
    if (!plot || !plot.owner) return null;
    if (plot.owner.id === me()) return game.player;
    return game.vehicles.find((v) => v.netId === plot.owner.id && v.alive) || null;
  };
  base.ownerFor = (by, name, ai) => {
    if (by === me()) return { id: by, name: getDriverName() || "You", paint: game.save.garage.paint, me: true };
    const d = DRIFTERS.find((x) => x.name === name);
    if (ai || d) return { id: by, name: name || "Drifter", paint: d ? d.paint : "#e6dfcc", ai: true };
    const v = game.netSync.remotes.find(by);
    return { id: by, name: name || game.netSync.remotes.name(by), paint: v ? v.mesh.paintMat.color.getStyle() : "#9cc8ff" };
  };
  base.bankAvail = () => (online() ? base.wallet.bank : game.save.banked);
  base.stashOf = (plot) => (plot ? plot.stash : 0);

  // Feedback line for the build bar (and a toast).
  base.no = (reason, extra = {}) => {
    const text = { scrap: `Not enough scrap${extra.need ? ` · need ${extra.need}` : ""}`, blocked: "Blocked", pos: "Outside the plot", full: "Plot full · 40 modules", owner: "Not your plot", dark: "Base is dark", taken: "Plot already taken", onePlot: "One plot per cycle", module: "Unknown module", far: "Too far from the rig", own: "That's your own rig", time: "Hold longer" }[reason] || reason;
    base.msg = { text, t: game.time };
    game.emit({ type: "minor", text: text.toUpperCase() });
  };

  // ---- actions ----
  base.requestClaim = (plotId, ai = null) => send("claim", { plot: plotId, ...(ai ? { ai: ai.id, name: ai.name } : {}) });

  base.validate = (plot, kind, x, z, rot, ai = null) => {
    if (!plot || !plot.owner || (!ai && plot.owner.id !== me()) || (ai && plot.owner.id !== ai.id)) return "owner";
    if (plot.dark) return "dark";
    if (!MODULE_IDS.includes(kind)) return "module";
    if (modules.forPlot(plot.id).filter((e) => e.kind !== "rig").length >= 40) return "full";
    const [w, d] = footprint(kind, rot);
    if (Math.abs(x) + w / 2 > HALF || Math.abs(z) + d / 2 > HALF) return "pos";
    const overlap = (ax, az, aw, ad) => Math.abs(x - ax) * 2 < w + aw - 0.01 && Math.abs(z - az) * 2 < d + ad - 0.01;
    for (const e of modules.forPlot(plot.id)) { const [ew, ed] = footprint(e.kind, e.rot); if (overlap(e.x, e.z, ew, ed)) return "blocked"; }
    if (overlap(HALF - 8, -HALF + 8, 3, 3)) return "blocked"; // the beacon
    if (base.piecesBlock && base.piecesBlock(plot, x, z, w, d)) return "blocked"; // built pieces on the ground
    if (!ai) { const cost = moduleDef(kind).cost; if (base.bankAvail() + plot.stash < cost) return { reason: "scrap", need: cost, have: Math.floor(base.bankAvail() + plot.stash) }; }
    return null;
  };
  base.requestBuild = (plotId, kind, x, z, rot = 0, ai = null) => {
    const plot = plots.byId[plotId];
    const r = base.validate(plot, kind, x, z, rot, ai);
    if (r) { if (!ai) base.no(r.reason || r, r); return false; }
    send("build", { plot: plotId, module: kind, x, z, rot, ...(ai ? { ai: ai.id, name: ai.name } : {}) });
    return true;
  };
  // Offline economy: banked scrap pays first, then the stash.
  base.payOffline = (plot, cost) => {
    const fromBank = Math.min(game.save.banked, cost);
    game.save.banked -= fromBank;
    plot.stash = Math.max(0, plot.stash - (cost - fromBank));
    if (!game.noSave) writeSave(game.save);
  };

  // ---- damage to modules: shots, explosions, rams. Reported by the shooter's browser, aggregated. ----
  const hits = new Map();
  let hitT = 0;
  base.damage = (e, dmg, shooter, point, srcId = null) => {
    if (!e || !e.alive || dmg <= 0) return;
    modules.hitFx(e, point);
    if (shooter) (shooter.hitBase ||= {})[e.plot] = game.time;
    if (game.cosmetic) return;
    const plot = e.plotRef;
    if (shooter && base.isOwner(plot, shooter)) return; // no self-damage from your own car or turrets
    if (shooter && shooter.remote) return;
    const src = srcId || (shooter && shooter !== game.player && net.isHost() ? game.netSync.nid(shooter) : null);
    const key = `${e.plot}|${e.id}|${src || ""}`;
    const h = hits.get(key) || { plot: e.plot, modId: e.id, dmg: 0, src };
    h.dmg += dmg; hits.set(key, h);
    if (shooter === game.player) game.onHitMarker(null, dmg);
    if (shooter) e.lastHitBy = shooter;
  };
  base.hitBox = (box, dmg, shooter, point) => { if (box && box.mod) base.damage(box.mod, dmg, shooter, point); };
  base.blast = (pos, radius, dmg, attacker) => {
    if (game.jobs) game.jobs.blast(pos, radius, dmg, attacker);
    for (const e of modules.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.wx - pos.x, e.wz - pos.z);
      if (d < radius + 2) base.damage(e, dmg * (1 - Math.min(1, d / (radius + 2))), attacker, pos);
    }
  };
  function flushHits(dt) {
    hitT -= dt;
    if (hitT > 0 || !hits.size) return;
    hitT = 0.2;
    for (const h of hits.values()) for (let left = h.dmg; left > 0.5; left -= 400) send("modHit", { plot: h.plot, modId: h.modId, dmg: Math.round(Math.min(400, left) * 10) / 10, ...(h.src ? { src: h.src } : {}) });
    hits.clear();
  }

  // ---- crates: server crates online (host spawns), plain pickups offline ----
  let crateSeq = 0;
  base.spawnCrate = (x, y, z, scrap, part = false) => {
    scrap = Math.max(1, Math.round(scrap));
    if (!online()) { game.pickups.spawn(x, y, z, scrap, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); if (part) game.pickups.list[game.pickups.list.length - 1].part = true; return; }
    if (!net.isHost()) return;
    const id = `c${me().slice(-4)}${Date.now().toString(36)}${crateSeq++}`;
    send("spawnCrate", { id, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, z: Math.round(z * 10) / 10, scrap, ...(part ? { part: "salvage" } : {}) });
    base.addCrate({ id, x, y, z, scrap, part });
  };
  base.addCrate = (c) => {
    if (game.pickups.list.some((p) => p.crateId === c.id)) return;
    game.pickups.spawn(c.x, c.y, c.z, c.scrap | 0);
    const pk = game.pickups.list[game.pickups.list.length - 1];
    pk.crateId = c.id; pk.part = !!c.part; pk.life = 600;
  };
  base.removeCrate = (id) => { const pk = game.pickups.list.find((p) => p.crateId === id); if (pk) game.pickups.take(pk); };
  base.lootCrate = (pk) => { send("loot", { crateId: pk.crateId }); game.pickups.take(pk); };

  // ---- alerts: siren, edge arrow home, minimap ping, radio line ----
  base.alertMine = (text, pos) => {
    const p = base.mine();
    if (!p) return;
    base.alert = { text, until: game.time + 8, x: pos ? pos.x : p.x, z: pos ? pos.z : p.z };
    if (game.time - base.lastAlert < 12) return;
    base.lastAlert = game.time;
    game.audio.siren?.(); game.audio.radio();
    game.emit({ type: "radio", from: `${p.name} base`, text });
  };

  // ---- blueprints (localStorage): current layout and last cycle's ----
  base.blueprint = () => local.getJSON(BP_KEY, null) || {};
  base.saveLayout = () => {
    const p = base.mine();
    if (!p || game.noSave) return;
    const bp = base.blueprint();
    bp.current = { n: game.cycle.n, list: modules.forPlot(p.id).filter((e) => e.kind !== "rig").map((e) => ({ module: e.kind, x: e.x, z: e.z, rot: e.rot })) };
    local.setJSON(BP_KEY, bp);
  };
  base.rollBlueprint = () => {
    if (game.noSave) return;
    const bp = base.blueprint();
    if (bp.current && bp.current.list.length) { bp.last = bp.current.list; bp.current = null; local.setJSON(BP_KEY, bp); }
  };
  base.lastLayout = () => { const bp = base.blueprint(); return bp.last || (bp.current && bp.current.n !== game.cycle.n ? bp.current.list : []) || []; };

  // ---- cycle reset: bases dissolve in dust ----
  base.resetAll = (dissolve = true) => {
    base.saveLayout(); base.rollBlueprint();
    for (const p of plots.list) { modules.clearPlot(p.id, dissolve ? "dissolve" : "now"); plots.setOwner(p.id, null); p.stash = 0; }
    base.claimed.clear(); base.aiWallets = {};
    base.wallet = { bank: 0, banked: 0, plot: null, stash: 0 };
    base.raids.reset(); base.aiBases.reset();
  };

  base.turrets = createTurrets(game);
  base.raids = createRaids(game);
  base.utility = createUtility(game);
  base.aiBases = createAiBases(game);
  const handlers = createWorldHandlers(game);
  let bound = null, offs = [];
  function bind() {
    for (const off of offs) off();
    bound = net.impl();
    offs = [bound.onWorld(handlers.onWorld), bound.onEvent(handlers.onEvent)];
  }
  base.handlers = handlers;
  base.start = (welcome) => { bind(); if (welcome) handlers.onWorld({ ...welcome, t: "welcome" }); };

  base.step = (dt) => {
    if (net.impl() !== bound) bind();
    plots.update(dt);
    base.raids.step(dt);
    base.utility.step(dt);
    base.aiBases.step(dt);
    if (net.isHost()) base.turrets.step(dt); else base.turrets.cosmeticStep(dt);
    flushHits(dt);
    if (base.alert && game.time > base.alert.until) base.alert = null;
  };
  base.frame = (dt) => modules.update(dt);
  base.rigPos = (plot) => new THREE.Vector3(plot.x, plot.y, plot.z);
  // Free-build pieces, named blueprints and the raider fortresses (pieces wrap step, frame and blast).
  attachPieces(game);
  base.blueprints = createBlueprints(game);
  base.forts = createFortresses(game);
  if (!game.modes.test && !game.modes.accel) base.forts.start();
  const stepPieces = base.step;
  base.step = (dt) => { stepPieces(dt); if (!(game.arena && game.arena.active)) base.forts.step(dt); };
  return base;
}