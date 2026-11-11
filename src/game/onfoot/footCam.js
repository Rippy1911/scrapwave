// Third-person camera for the scavenger: the mouse (or right stick) orbits it freely, it pulls in when a wall
// is between the character and the camera, and never dips under the ground. Same yaw convention as the chase
// cam: yaw 0 sits behind a character facing -z.
// Aiming (setAim) moves it over the right shoulder, closer and narrower, so the screen centre is the line of fire;
// a scope (setAim with a field of view) looks through the eye itself. ray() is that line of fire.
import * as THREE from "three";

const FOV = 62, DIST = 4.3, HEAD = 1.5;
const AIM = { fov: 48, dist: 1.9, side: 0.55, head: 1.58, eye: 1.62 };
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function createFootCam(camera, world) {
  const c = { yaw: 0, pitch: 0.22, pos: new THREE.Vector3(), look: new THREE.Vector3(), aim: 0 };
  const dir = new THREE.Vector3(), want = new THREE.Vector3(), right = new THREE.Vector3();
  let aimOn = false, scopeFov = 0;

  c.orbit = (dx, dy) => {
    const k = scopeFov ? scopeFov / FOV : aimOn ? 0.7 : 1; // slower through the scope
    c.yaw -= dx * 0.0035 * k;
    c.pitch = clamp(c.pitch + dy * 0.0025 * k, aimOn ? -1.1 : -0.3, 1.1);
  };
  c.snapBehind = (heading) => { c.yaw = heading; c.pitch = 0.22; };
  // Ground-plane forward of the camera (where W walks).
  c.forward = (out) => out.set(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
  // on: over the shoulder. fov > 0: through a scope with that field of view.
  c.setAim = (on, fov = 0) => { aimOn = !!on; scopeFov = on ? fov : 0; };
  c.aiming = () => aimOn;
  c.scoped = () => scopeFov > 0;
  // The line of fire through the screen centre: o on the camera, d unit length. Returns { o, d } (new vectors).
  c.ray = () => ({ o: c.pos.clone(), d: c.look.clone().sub(c.pos).normalize() });

  c.update = (target, dt, snap = false) => {
    const to = aimOn ? 1 : 0;
    c.aim = snap ? to : c.aim + (to - c.aim) * (1 - Math.exp(-dt * 12));
    dir.set(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
    if (scopeFov) { // the eye: no boom, nothing to pull in
      c.pos.set(target.x, target.y + AIM.eye, target.z).addScaledVector(dir, -0.25);
      c.look.copy(c.pos).addScaledVector(dir, -10);
      return;
    }
    const a = c.aim, full = DIST + (AIM.dist - DIST) * a;
    right.set(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    c.look.set(target.x, target.y + HEAD + (AIM.head - HEAD) * a, target.z).addScaledVector(right, AIM.side * a);
    let d = full;
    const hit = world.colliders.raycast(c.look.x, c.look.y, c.look.z, dir.x, dir.y, dir.z, full);
    if (hit) d = Math.max(0.8, hit.t - 0.3);
    want.copy(c.look).addScaledVector(dir, d);
    if (snap) c.pos.copy(want);
    else c.pos.lerp(want, 1 - Math.exp(-dt * 14));
    const g = world.terrain.heightAt(c.pos.x, c.pos.z) + 0.5;
    if (c.pos.y < g) c.pos.y = g;
  };

  c.apply = () => {
    camera.position.copy(c.pos);
    camera.lookAt(c.look);
    const fov = scopeFov || FOV + (AIM.fov - FOV) * c.aim;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };
  return c;
}