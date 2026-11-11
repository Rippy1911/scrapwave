// Turns the hour's sun height and the weather into the look of the sky, light and fog (round 14). Three tuned looks
// (day, dusk, night) are blended by the sun's elevation, the weather is laid over them, and the result is written
// into the sky object from render/sky.js. The sky's haze band always takes the fog's colour (sky.setStorm copies it),
// so the line where ground meets sky matches at every hour and in every weather.
import * as THREE from "three";
import { RENDER } from "@/game/data/tuning";
import { nightK, duskK } from "@/game/world/sky/dayClock";

const F = RENDER.fog, S = RENDER.sky;
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
const LOOKS = {
  day: { sun: RENDER.sunIntensity, sunC: lin(...RENDER.sunColor), hemi: RENDER.hemiIntensity, fog: new THREE.Color(F.color), dens: 1, env: 1, turb: S.turbidity, ray: S.rayleigh, gain: 1, hazeH: 0.16, haze: S.haze, tint: F.sunTint, exp: 1 },
  dusk: { sun: 2.3, sunC: lin(1, 0.42, 0.16), hemi: 0.16, fog: new THREE.Color("#b8704a"), dens: 1.25, env: 0.32, turb: 5, ray: 2.4, gain: 0.8, hazeH: 0.42, haze: 0.95, tint: [1.9, 1, 0.55], exp: 1.3 },
  night: { sun: 0.55, sunC: lin(0.5, 0.64, 1), hemi: 0.2, fog: new THREE.Color("#0c1422"), dens: 1.1, env: 0.16, turb: 2, ray: 1, gain: 0.5, hazeH: 0.3, haze: 0.9, tint: [1, 1, 1], exp: 1.45 },
};
const MOON = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(RENDER.sunAzimuth + 140));
const D = Math.PI / 180;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const trueSun = new THREE.Vector3(), col = new THREE.Color(), tintC = new THREE.Color();

// elev, az: the sun (degrees). W: the weather numbers (world/sky/weather.js out). Returns the night weight 0..1.
export function applyDayLook(sky, renderer, scene, elev, az, W) {
  const wN = nightK(elev), wD = duskK(elev) * (1 - wN), w0 = Math.max(0, 1 - wN - wD);
  const m = (k) => LOOKS.day[k] * w0 + LOOKS.dusk[k] * wD + LOOKS.night[k] * wN;
  const mc = (k, out) => out.setRGB(0, 0, 0).add(col.copy(LOOKS.day[k]).multiplyScalar(w0)).add(col.copy(LOOKS.dusk[k]).multiplyScalar(wD)).add(col.copy(LOOKS.night[k]).multiplyScalar(wN));
  const u = sky.sky.material.uniforms;

  // The sky shows the real sun; the one shadowed light is the sun by day and the moon once it has set.
  trueSun.setFromSphericalCoords(1, (90 - elev) * D, az * D);
  u.sunPosition.value.copy(trueSun);
  const sunUp = elev > -2;
  if (sunUp) sky.sunDir.setFromSphericalCoords(1, (90 - Math.max(elev, 2.5)) * D, az * D); else sky.sunDir.copy(MOON);
  const lightK = sunUp ? clamp01((elev + 2) / 4) : clamp01((-elev - 2) / 4);

  mc("sunC", sky.sun.color);
  sky.base.sun = m("sun") * lightK * W.dim;
  sky.base.hemi = m("hemi") * W.hemi;
  // The weather's colour is scaled down with the daylight, so fog at night is dark fog, not a glowing wall.
  tintC.setRGB(W.tint[0], W.tint[1], W.tint[2]).multiplyScalar(1 - 0.82 * wN);
  mc("fog", sky.base.fog).lerp(tintC, W.tintK);
  sky.base.density = F.density * m("dens") * W.dens;
  sky.envIntensity = RENDER.envIntensity * m("env") * W.hemi;
  scene.environmentIntensity = sky.envIntensity;
  u.rayleigh.value = m("ray");
  u.uSkyGain.value = S.gain * m("gain") * W.gain;
  u.uHazeH.value = m("hazeH");
  u.uHaze.value = Math.max(m("haze"), W.tintK);
  u.uHazeSun.value.set(LOOKS.day.tint[0] * w0 + LOOKS.dusk.tint[0] * wD + wN, LOOKS.day.tint[1] * w0 + LOOKS.dusk.tint[1] * wD + wN, LOOKS.day.tint[2] * w0 + LOOKS.dusk.tint[2] * wD + wN);
  renderer.toneMappingExposure = RENDER.exposure * m("exp");
  sky.mode = wN > 0.5 ? "night" : wD > 0.5 ? "dusk" : "day";
  sky.setStorm(sky.storm); // writes fog colour and density, light strengths and the haze colour from sky.base
  u.turbidity.value = m("turb") + sky.storm * 10;
  if (W.flash > 0) { sky.hemi.intensity += W.flash * 2.4; sky.sun.intensity += W.flash * 1.5; }
  return wN;
}