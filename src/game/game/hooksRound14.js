// Round 14 test hooks (merged into window.scrapwake by game/hooks.js):
//   flight.state() / flight.mode("off" | "arcade" | "high") / flight.launch({ height, speed, pitch }) / flight.aero(mass, halfX, halfZ, wings)
//   check14() -> { ok, results: [[name, pass, detail]] }
import * as THREE from "three";
import { WORLD } from "@/game/data/tuning";
import { flightState, flightMode, setFlightMode, FLIGHT_MODES, holdFrac, shapeOf, aeroScore, airDrain, airTurbo } from "@/game/vehicles/turboFlight";
import { AIM_UP, AIM_DOWN, clampPitch, limitAim, elevationDeg } from "@/game/weapons/aimLimits";
import { round14Checks } from "@/game/game/check14";
import { packState, model } from "@/game/assets/cdnPack";

const UP = new THREE.Vector3(0, 1, 0);

// A stand-in car for the force maths: only the fields turboFlight reads.
const fake = (mass, half, bike = false) => ({ mass, loadMass: 0, chassis: { hit: { half } }, stats: { bike }, airTime: 1, turbo: 1, tankTier: 1 });

// Net vertical push (in g) on a wingless car burning turbo with the nose at `pitch` radians, in the current mode.
function netUp(mass, half, pitch, bike) {
  const v = fake(mass, half, bike), f = new THREE.Vector3(), fwd = new THREE.Vector3(0, Math.sin(pitch), -Math.cos(pitch));
  airTurbo(v, f, fwd, 20, 40, 12, WORLD.gravity, false);
  return f.y / mass / WORLD.gravity;
}

export function flightChecks(add) {
  const was = flightMode();
  setFlightMode("arcade");
  const heavy = holdFrac(3500, shapeOf(1.25, 4.1)), light = holdFrac(700, shapeOf(0.9, 2)), bike = holdFrac(250, shapeOf(0.4, 1, true));
  add("heavy car sinks slowly", heavy >= 0.4 && heavy < 0.6, `holds ${heavy.toFixed(2)} of its weight`);
  add("light car nearly hovers", light >= 0.9 && light < 1, `holds ${light.toFixed(2)}`);
  add("bike nearly hovers", bike >= light && bike < 1, `holds ${bike.toFixed(2)}`);
  const climb = netUp(900, [0.9, 0.7, 2], 1.2, false);
  add("wingless car never climbs (arcade)", climb < 1, `${climb.toFixed(2)} g with the nose up`);
  add("aero stat: wings add 25 each", aeroScore(900, 1, 2) - aeroScore(900, 1, 0) === 50);
  const d1 = airDrain({ tankTier: 1 }, false, 0.45), d3 = airDrain({ tankTier: 3 }, false, 0.45), dw = airDrain({ tankTier: 1 }, true, 0.45);
  add("bigger tank flies longer", d3 < d1, `${(4 / d1).toFixed(1)} s -> ${(4 / d3).toFixed(1)} s`);
  add("wings save fuel", dw < d1);
  setFlightMode("off");
  const off = netUp(900, [0.9, 0.7, 2], 0, false);
  add("Flight off: no hold force", Math.abs(off) < 1e-6, `${off.toFixed(2)} g level`);
  setFlightMode("high");
  add("Flight high: light car can hold level", netUp(700, [0.9, 0.7, 2], 0, false) >= 1);
  add("three flight modes", Object.keys(FLIGHT_MODES).join() === "off,arcade,high");
  setFlightMode(was);
  // Aim limits (B): 35 up, 20 down, for every gun.
  const q = new THREE.Quaternion(), up = limitAim(new THREE.Vector3(0, 1, 0), q), down = limitAim(new THREE.Vector3(0, -1, -0.2).normalize(), q);
  add("aim stops 35 degrees up", Math.abs(elevationDeg(up) - 35) < 0.2 && clampPitch(2) === AIM_UP, `${elevationDeg(up)}`);
  add("aim stops 20 degrees down", Math.abs(elevationDeg(down) + 20) < 0.2 && clampPitch(-2) === -AIM_DOWN, `${elevationDeg(down)}`);
}

export function round14Hooks(game) {
  return {
    flight: {
      state: () => flightState(game.player, WORLD.gravity),
      mode: (id) => (id ? setFlightMode(id) : flightMode()),
      aero: (mass = 1000, halfX = 1, halfZ = 2, wings = 0) => aeroScore(mass, shapeOf(halfX, halfZ), wings),
      // Put the player's car in the air with a full tank: height above the ground (m), speed along the nose (km/h).
      launch(o = {}) {
        const v = game.player, h = o.height ?? 40, sp = (o.speed ?? 90) / 3.6;
        const yaw = Math.atan2(-new THREE.Vector3(0, 0, -1).applyQuaternion(v.quat).x, -new THREE.Vector3(0, 0, -1).applyQuaternion(v.quat).z);
        v.quat.setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), o.pitch || 0));
        v.pos.y = game.world.groundAt(v.pos.x, v.pos.z, v.pos.y + 1) + h;
        v.vel.set(0, 0, -sp).applyQuaternion(v.quat); v.angVel.set(0, 0, 0);
        v.turbo = 1;
        return flightState(v, WORLD.gravity);
      },
    },
    // sky.state() / sky.hour(0..24) / sky.weather("clear" | "dust" | "rain" | "fog" | "storm" | "random")
    sky: {
      state: () => game.skyCycle.state(),
      hour(h) { game.skyCycle.setHour(h); return game.skyCycle.state(); },
      weather(w) { game.skyCycle.setWeather(w); return game.skyCycle.state(); },
    },
    // Hosted pack: cdn.state() (manifest, what loaded), await cdn.probe("zombie") (load one model), cdn.sounds(), cdn.horde()
    cdn: {
      state: () => packState(),
      probe: (key = "zombie") => model(key).then((t) => (t ? { key, height: +t.height.toFixed(2), skinned: t.skinned, clips: Object.keys(t.clips) } : null)),
      sounds: () => game.audio.sampleState(),
      horde: () => game.arena.horde.models(),
    },
    check14() {
      const results = [], add = (name, pass, detail = "") => results.push([name, !!pass, detail]);
      flightChecks(add);
      round14Checks(game, add);
      return { ok: results.every((x) => x[1]), results };
    },
  };
}