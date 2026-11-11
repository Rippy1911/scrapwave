// Snapshot of game state for the React HUD (sent ~10x per second).
import { PLACES } from "@/game/data/places";
import { VEHICLES } from "@/game/data/tuning";
import { TIER_NAME } from "@/game/data/drifters";
import { threats } from "@/game/game/threats";
import { baseHud } from "@/game/base/hudInfo";

function scoreboard(game) {
  const p = game.player;
  const rows = [{ name: "You", ai: false, tier: "", vehicle: p.stats.name, wrecks: game.session.wrecks, banked: game.session.banked, alive: p.alive, me: true }];
  for (const h of game.netSync.scoreRows()) rows.push({ name: h.name, ai: false, human: true, tier: "", vehicle: h.vehicle, wrecks: h.wrecks, banked: h.banked, alive: h.alive, key: h.id });
  for (const e of game.drifters.roster) {
    rows.push({ name: e.name, ai: true, tier: TIER_NAME[e.skill], vehicle: VEHICLES[e.chassis].name, wrecks: e.wrecks, banked: e.banked, alive: !!(e.v && e.v.alive), payback: e.payback });
  }
  // Humans first, then Drifters; each group by score.
  return rows.sort((a, b) => (a.ai - b.ai) || (b.banked + b.wrecks * 50 - (a.banked + a.wrecks * 50)));
}

export function buildHud(game) {
  const p = game.player;
  const place = PLACES.find((pl) => Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z) < pl.r);
  const dots = [];
  for (const v of game.vehicles) {
    if (v === p || !v.alive) continue;
    if (Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) < 420) dots.push({ x: v.pos.x, z: v.pos.z, t: v.team, pb: !!(v.brain && v.brain.payback) });
  }
  for (const k of game.pickups.list) {
    if (Math.hypot(k.g.position.x - p.pos.x, k.g.position.z - p.pos.z) < 300) dots.push({ x: k.g.position.x, z: k.g.position.z, t: "scrap" });
  }
  const near = game.vehicles.filter((v) => v.alive && v.team === "rattler" && v.pos.distanceTo(p.pos) < 150).length;
  const aim = game.playerAim.hud();
  const lt = aim.mode === "manual" ? p.lockTarget : null; // assisted aim draws its own marker (ui/LockMarker)
  const th = threats(game);
  const grp = (w) => w.group || (w.def.kind === "rocket" ? "heavy" : w.def.kind === "harpoon" ? "aux" : "guns"); // fire group (weapons/binds.js)
  const hasRockets = p.weapons.some((w) => grp(w) === "heavy" && !w.disabled);
  const foot = game.onfoot.hud();
  return {
    hull: p.hull, maxHull: p.maxHull, turbo: p.turbo, turboOn: !!p.turboActive,
    fuel: p.fuel / p.fuelMax, fuelUnits: Math.ceil(p.fuel), limp: !!p.limp, refuelling: !!p.refuelling || (p.canFlash || 0) > 0,
    replayOffer: game.replay.offer(), replaying: game.replay.active ? game.replay.badge() : null,
    demo: game.demo.running ? game.demo.state() : null,
    speed: Math.round(p.vel.length() * 3.6), scrap: p.scrap, banked: game.save.banked,
    legendOn: game.save.legend !== false, // round 14: the on-screen key legend (ui/KeyLegend.jsx)
    weapons: p.weapons.map((w) => {
      const d = w.def;
      const total = d.kind === "rocket" ? d.reload : d.kind === "pellets" ? d.reload : d.kind === "harpoon" ? d.reload : 0;
      return { id: w.id, name: d.name, disabled: !!w.disabled, key: { guns: "LMB", heavy: "F·K", aux: hasRockets ? "E" : "E·K", off: "OFF" }[grp(w)], ready: total ? 1 - Math.max(0, w.cd) / total : 1 };
    }),
    safe: !!foot.zone, zone: foot.zone, foot, garage: game.inGarage(p), alive: p.alive, respawnIn: Math.max(0, game.respawnIn),
    arena: game.arena.hud(), worldMap: game.maps ? game.maps.current() : null, race: game.tracks ? game.tracks.hud() : null,
    flight: game.air.hud(),
    location: game.arena.active ? game.arena.map.name : game.big && game.big.active ? game.big.placeName() : place ? place.name : "The Saltreach", x: foot.x, z: foot.z, yaw: game.cam.yaw + game.cam.orbitYaw, dots,
    lock: lt && lt.alive ? { name: lt.name, hull: lt.hull / lt.maxHull, skill: lt.skillName } : null,
    air: !p.contacts && p.airTime > 0.5 ? p.airTime : 0,
    partsOff: p.mesh.parts.filter((x) => x.detached).length,
    traps: game.traps.hud(), mech: game.mech.hud(), aim, smoke: p.smokeModule ? Math.max(0, p.smokeCd || 0) : null,
    near,
    threats: th.arrows, lockedOn: th.lockedOn,
    scoreboard: game.input.a.scoreboard ? scoreboard(game) : null,
    autopilot: !!game.autopilot, intro: game.introT > 0, net: game.netSync.pill(),
    ...baseHud(game),
    aimFree: !game.input.a.locked && !game.input.a.usingPad && !game.autopilot && !game.input.a.touch,
    touch: game.touch.enabled() ? game.touch.mode() : null, // "drive" | "foot" | "air" with touch controls on
    debug: game.debug || game.selfReport ? {
      fps: Math.round(1000 / Math.max(1, game.loop.frameMs)), ms: game.loop.frameMs.toFixed(1),
      calls: game.rend.stats.calls, ktris: Math.round(game.rend.stats.tris / 1000), quality: game.rend.quality, ratio: game.rend.pixelRatio.toFixed(2),
      vehicles: game.vehicles.length, drifters: game.vehicles.filter((v) => v.alive && v.team === "drifter").length,
      rattlers: game.vehicles.filter((v) => v.alive && v.team === "rattler").length,
      pos: `${p.pos.x.toFixed(0)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(0)}`, grounded: p.grounded, contacts: p.contacts,
      mode: p.brain ? p.brain.mode : "manual", stuck: (p.stuckT || 0).toFixed(1),
      test: game.testReport ? { ...game.testReport, buggy: undefined } : null, accel: game.accelReport || null,
      self: game.selfReport ? { ...game.selfReport, st: undefined } : null,
      fuel: `${p.fuel.toFixed(1)} / ${p.fuelMax}${p.limp ? " LIMP" : ""}`, demo: game.demo.state(),
    } : null,
  };
}