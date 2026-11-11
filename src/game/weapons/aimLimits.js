// How far any gun may elevate (round 14): 35 degrees above the mount's level and 20 below. Shared by the player's
// mounts, the AI, base turrets and assisted aim, so nobody shoots where their barrels cannot point.
import * as THREE from "three";

const D = Math.PI / 180;
export const AIM_UP = 35 * D, AIM_DOWN = 20 * D;
export const CROSS_Y = 0.12, CROSS_RISE = 0.5; // crosshair height on screen (ndc): at rest, and how far it climbs at full aim-up
export const LOOK_RISE = 2.9; // metres the chase camera's look point lifts at full aim-up ("follows a little")

export const clampPitch = (p) => Math.max(-AIM_DOWN, Math.min(AIM_UP, p));

const inv = new THREE.Quaternion(), loc = new THREE.Vector3();

// Clamp a unit direction to the limits, measured in the frame of `quat` (the car body or the turret base).
// Returns dir (changed in place only when it was outside the limits).
export function limitAim(dir, quat) {
  loc.copy(dir).applyQuaternion(inv.copy(quat).invert());
  const flat = Math.hypot(loc.x, loc.z), p = Math.atan2(loc.y, flat);
  if (p <= AIM_UP && p >= -AIM_DOWN) return dir;
  const c = clampPitch(p), k = flat > 1e-5 ? Math.cos(c) / flat : 0;
  loc.set(loc.x * k, Math.sin(c), flat > 1e-5 ? loc.z * k : -Math.cos(c));
  return dir.copy(loc.applyQuaternion(quat)).normalize();
}

// Crosshair height on screen for the chase camera's aim-up fraction (0..1).
export const crossY = (cam) => CROSS_Y + CROSS_RISE * (cam ? cam.aimUp || 0 : 0);

// Elevation of a direction above the world's level, in degrees (test hook: aim.pitch()).
export const elevationDeg = (dir) => Math.round((Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) / D) * 10) / 10;