// Base, cycle, job and world-event fields for the HUD snapshot.
import * as THREE from "three";

const v3 = new THREE.Vector3();

function edgeArrow(game, x, y, z) {
  v3.set(x, y, z).project(game.camera);
  let sx = v3.x, sy = v3.y;
  if (v3.z > 1) { sx = -sx; sy = -sy; }
  return Math.atan2(-sy, sx);
}

export function baseHud(game) {
  const b = game.base, p = game.player, mine = b.mine();
  const claim = b.plots.claimState();
  const rig = mine && b.modules.rigOf(mine.id);
  const plots = b.plots.list.map((pl) => ({ id: pl.id, x: pl.x, z: pl.z, name: pl.owner ? pl.owner.name : null, mine: !!(pl.owner && pl.owner.id === game.selfId()), dark: pl.dark, paint: pl.owner ? pl.owner.paint : null, siphon: b.raids.hold(pl.id) }));
  const here = b.plots.at(p.pos.x, p.pos.z);
  let prompt = null;
  if (here && !here.owner && !b.claimedThisCycle(game.selfId())) prompt = claim ? null : `Stop by the beacon to claim ${here.name}`;
  else if (here && mine === here && !here.dark && !game.buildView.active) prompt = "Press B to build";
  const alert = b.alert ? { text: b.alert.text, a: edgeArrow(game, b.alert.x, p.pos.y, b.alert.z), x: b.alert.x, z: b.alert.z, d: Math.round(Math.hypot(b.alert.x - p.pos.x, b.alert.z - p.pos.z)) } : null;
  const wl = game.warlord.vehicle(), cv = game.convoy.lead();
  return {
    cycle: game.cycleSys.hud(),
    storm: game.stormK || 0, stormR: game.cycle.stormOn ? game.cycle.stormR : 0,
    claim, prompt, alert, plots,
    myBase: mine ? { name: mine.name, stash: Math.floor(mine.stash), dark: mine.dark, rig: rig ? rig.hp / rig.maxHp : 0, raiders: b.raids.raiders(mine.id), siphon: b.raids.hold(mine.id) } : null,
    build: game.buildView.hud(),
    jobs: game.jobs.hud(),
    warlord: wl ? { x: wl.pos.x, z: wl.pos.z, hull: wl.hull / wl.maxHull } : null,
    convoy: cv ? { x: cv.x, z: cv.z } : null,
    padRepair: !!p.padRepair,
    fort: b.forts ? b.forts.hud() : null,
  };
}