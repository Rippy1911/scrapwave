// The player's aim each frame. Assisted (default): lock the target nearest the crosshair in a forward cone,
// point the guns at it (half lead for slow unguided rounds), rockets home after a 0.6 s lock, Tab cycles.
// Manual: the old free crosshair aim (game/player.js updateAim), no lock.
import * as THREE from "three";
import { createAimAssist, ASSIST } from "@/game/weapons/aimAssist";
import { gatherTargets, targetVisible } from "@/game/weapons/targets";
import { drawLock } from "@/game/weapons/lockView";
import { lockTone } from "@/game/weapons/lockTone";
import { writeSave } from "@/game/core/save";
import { crossY } from "@/game/weapons/aimLimits";

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(0, 0.12);
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ahead = new THREE.Vector3(), eye = new THREE.Vector3();
const SLOW = new Set(["shell", "harpoon", "cannon"]); // unguided projectiles that need lead

// Range of the car's main guns (what the lock is judged against).
function gunRange(v) {
  let r = 0;
  for (const w of v.weapons) if (!w.disabled && w.def.kind !== "rocket" && w.def.kind !== "harpoon") r = Math.max(r, w.def.range);
  if (!r) for (const w of v.weapons) if (!w.disabled) r = Math.max(r, w.def.range);
  return r || 200;
}

export function createPlayerAim(game) {
  const assist = createAimAssist();
  assist.setMode(game.save.aimMode || "assisted");
  let wasReady = false, last = 0;

  function aimFor(w, from) {
    const st = assist.st;
    if (!st.lock || !st.inRange) return null;
    return SLOW.has(w.def.kind) ? assist.aimPoint(from, w.def.speed, ASSIST.leadFrac) : st.lock.c.pos;
  }

  // Runs in the render frame after the camera moved (player.updateAim is the manual path).
  function update(v, manual) {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    const cycle = game.input.edge("target");
    if (assist.mode() === "manual" || !v.alive) {
      v.aimFor = null; assist.clear(); drawLock(game.camera, null, null);
      return manual(game, v);
    }
    const a = game.input.a;
    if (!a.locked && a.mouseActive && !a.usingPad) ndc.set(a.mouseX * 2 - 1, -(a.mouseY * 2 - 1));
    else ndc.set(0, crossY(game.cam)); // the crosshair climbs when the aim goes above the horizon
    ray.setFromCamera(ndc, game.camera);
    const d = ray.ray.direction;
    eye.copy(v.pos); eye.y += 1.2; // the cone is centred on the car, pointing where the crosshair looks
    q.setFromRotationMatrix(m4.lookAt(eye, ahead.copy(eye).add(d), game.camera.up));
    const R = gunRange(v);
    const st = assist.update(dt, gatherTargets(game, v, R * ASSIST.rangeShow + 5), eye, q, R, { cycle, los: (c) => targetVisible(game, v, c) });
    const ready = assist.rocketReady();
    if (ready && !wasReady) lockTone(game.save);
    wasReady = ready;
    v.lockTarget = ready ? st.lock.c.homing : null; // rockets home only on a closed lock
    if (st.lock && st.inRange) { v.aimFor = aimFor; v.aimPoint.copy(st.lock.c.pos); }
    else {
      v.aimFor = null;
      const o = ray.ray.origin;
      const start = o.clone().addScaledVector(d, v.mesh.root.position.distanceTo(o) + 2);
      v.aimPoint.copy(game.combat.ray(start, d, 260, v).point);
    }
    const hasRockets = v.weapons.some((w) => w.def.kind === "rocket" && !w.disabled);
    drawLock(game.camera, st, hasRockets ? st.lockT / ASSIST.rocketLock : null);
    return st.lock && st.lock.c.kind === "car" ? st.lock.c.key : null;
  }

  return {
    assist, update,
    hide() { drawLock(game.camera, null, null); game.input.edge("target"); },
    mode: () => assist.mode(),
    setMode(m) { assist.setMode(m); game.save.aimMode = assist.mode(); if (!game.noSave) writeSave(game.save); return assist.mode(); },
    lock: () => assist.lockInfo(),
    hud: () => ({ mode: assist.mode(), locked: !!assist.st.lock && assist.st.inRange, rocketLock: assist.rocketReady() }),
  };
}