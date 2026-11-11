// Chase camera: lagged yaw follow, mouse/stick orbit, speed FOV, trauma shake.
import * as THREE from "three";
import { CAMERA } from "@/game/data/tuning";
import { LOOK_RISE, crossY } from "@/game/weapons/aimLimits";

const AIM_GAIN = 2.2; // aim-up fraction gained per radian of extra upward mouse travel

export function createChaseCam(camera) {
  const c = {
    yaw: 0, pitch: 0.12, orbitYaw: 0, orbitPitch: 0, idle: 0, shake: 0, mode: 0,
    pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: CAMERA.fovMin,
  };
  const fwd = new THREE.Vector3(), tgt = new THREE.Vector3(), off = new THREE.Vector3(), rel = new THREE.Vector3();

  c.addTrauma = (k) => { c.shake = Math.min(CAMERA.maxShake, c.shake + k); };
  // Aim above the horizon (round 14): once the orbit is as low as it goes, pushing the mouse further up raises
  // c.aimUp (0..1). The crosshair climbs the screen with it and the look point lifts a little (weapons/aimLimits.js).
  c.aimUp = 0;
  let shownUp = -1;
  c.orbit = (dx, dy) => {
    c.orbitYaw -= dx * 0.0035;
    let dp = dy * 0.0025;
    if (dp > 0 && c.aimUp > 0) { const take = Math.min(c.aimUp, dp * AIM_GAIN); c.aimUp -= take; dp -= take / AIM_GAIN; }
    const want = c.orbitPitch + dp;
    c.orbitPitch = Math.max(-0.25, Math.min(0.7, want));
    if (want < -0.25) c.aimUp = Math.min(1, c.aimUp + (-0.25 - want) * AIM_GAIN);
    c.idle = 0;
  };
  // Free mouse (no pointer lock): the top part of the screen raises the aim. my: mouse height 0 (top) .. 1.
  c.aimFromScreen = (my, dt) => {
    const want = Math.max(0, Math.min(1, (0.42 - my) / 0.42));
    c.aimUp += (want - c.aimUp) * Math.min(1, dt * 6);
    if (want > 0.02) c.idle = 0;
  };
  c.snap = (v) => {
    fwd.set(0, 0, -1).applyQuaternion(v.mesh.root.quaternion);
    c.yaw = Math.atan2(-fwd.x, -fwd.z); c.orbitYaw = 0;
    c.update(v, 1, true, 0);
  };
  c.update = (v, dt, snap = false, speedKmh = 0, turbo = false) => {
    const root = v.mesh.root;
    const cfg = v.stats.cam === "bus" ? CAMERA.bus : CAMERA.car;
    const big = 1 + (v.mechState ? v.mechState.k : 0) * 0.9; // a standing walker is tall: pull back as it unfolds
    const dist = cfg.dist * (c.mode === 1 ? 1.5 : 1) * big, height = cfg.height * (c.mode === 1 ? 1.4 : 1) * big;
    fwd.set(0, 0, -1).applyQuaternion(root.quaternion);
    const want = Math.atan2(-fwd.x, -fwd.z);
    let d = want - c.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    c.yaw += snap ? d : d * Math.min(1, dt * CAMERA.follow * (v.grounded ? 1 : 0.35));
    c.idle += dt;
    if (c.idle > CAMERA.idleRecenter) { c.orbitYaw *= 1 - Math.min(1, dt * 2); c.orbitPitch *= 1 - Math.min(1, dt * 2); c.aimUp *= 1 - Math.min(1, dt * 1.2); if (c.aimUp < 0.004) c.aimUp = 0; }
    const yaw = c.yaw + c.orbitYaw, pitch = 0.22 + c.orbitPitch;
    off.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    tgt.copy(root.position).add(off); tgt.y += height - dist * Math.sin(pitch) * 0.6;
    // Ride with the car: across the ground only the camera's offset from the car eases (orbit and mode changes stay
    // smooth; the yaw above already lags the turns), so the gap never grows with speed or jumps on a long frame. It
    // used to chase the car's world position, so the car sat speed x lag ahead and slid back toward the camera on
    // every slow frame. Height still eases in world space: bumps and landings stay soft. Frame-rate independent.
    const k = snap ? 1 : 1 - Math.exp(-dt * 12);
    rel.x += (off.x - rel.x) * k; rel.z += (off.z - rel.z) * k;
    c.pos.set(root.position.x + rel.x, c.pos.y + (tgt.y - c.pos.y) * k, root.position.z + rel.z);
    c.look.copy(root.position); c.look.y += height * 0.45 + LOOK_RISE * c.aimUp * big;
    if (Math.abs(c.aimUp - shownUp) > 0.002) { // the HUD crosshair reads this (ui/Crosshair.jsx)
      shownUp = c.aimUp;
      document.documentElement.style.setProperty("--sw-cross-y", `${((1 - crossY(c)) / 2) * 100}%`);
    }
    const fovT = CAMERA.fovMin + (CAMERA.fovMax - CAMERA.fovMin) * Math.min(1, speedKmh / 150) + (turbo ? CAMERA.turboFov : 0);
    c.fov += (fovT - c.fov) * Math.min(1, dt * 3);
    c.shake = Math.max(0, c.shake - CAMERA.shakeDecay * dt);
  };
  c.apply = (groundAt, time) => {
    camera.position.copy(c.pos);
    const g = groundAt(c.pos.x, c.pos.z, c.pos.y + 3) + 1;
    if (camera.position.y < g) camera.position.y = g;
    const s = c.shake * c.shake;
    camera.position.x += (Math.sin(time * 47) + Math.sin(time * 31)) * s * 0.6;
    camera.position.y += Math.sin(time * 53) * s * 0.6;
    camera.lookAt(c.look);
    camera.rotation.z += Math.sin(time * 37) * s * 0.05;
    if (Math.abs(camera.fov - c.fov) > 0.05) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
  };
  return c;
}