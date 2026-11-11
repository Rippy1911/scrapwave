// Flying on turbo (round 14). On the wheels turbo is physics.js's. With no wheel down, turbo is jet thrust along the
// nose (JET x the old air push) plus a hold force that carries part of the car's weight. How much it carries is the
// car's "aero": body shape and weight. A heavy wingless car sinks slowly, a light car or a bike nearly hovers, and a
// winged car gets no hold at all: its wings (vehicles/wingFlight.js) turn the thrust into real lift, so it climbs.
// The Flight rule picks the mode: off (the old air push, capped climb), arcade (default) or high.
// Round 16: a wingless car or bike jets at FEEL.turboAirWingless x that, fading with speed like the ground turbo's extra
// and gone at the turbo top speed (vehicles/feel.js turboGain), in every mode: it steers and holds a flight instead of
// firing the car off like a rocket. Winged cars keep the round 14 jet: their wings turn it into lift and their drag
// already holds the speed down.
import { TURBO } from "@/game/data/tuning";
import { FEEL, turboGain } from "@/game/vehicles/feel";

export const FLIGHT_MODES = {
  off: { name: "Off", jet: 1, hold: 0, drain: 1 },
  arcade: { name: "Arcade", jet: 2.5, hold: 1, drain: 1.4 },
  high: { name: "High", jet: 3, hold: 1.12, drain: 1.05 },
};
export const TANK_TIER = [1, 1, 1.35, 1.7]; // turbo tank Tier I, II, III: how long a full tank lasts in the air
const OLD_LIFT_CAP = 0.45; // "off": the climbing part of the old air push, in g (feel.js turboAirLift)
const HOLD_MIN = 0.42, HOLD_MAX = 0.97;
let mode = FLIGHT_MODES.arcade, modeId = "arcade";

export function setFlightMode(id) { modeId = FLIGHT_MODES[id] ? id : "arcade"; mode = FLIGHT_MODES[modeId]; return modeId; }
export const flightMode = () => modeId;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Body shape 0.8 (a bus) .. 1.05 (a bike) from the footprint, and the weight share the jet can carry at this mass.
export function shapeOf(halfX = 1, halfZ = 2, bike = false) { return clamp(1.08 - (halfX * halfZ * 4) / 90, 0.8, 1) + (bike ? 0.05 : 0); }
export const massShare = (mass) => clamp(1.12 - mass / 5000, 0.5, 1);
// Part of the car's weight the jet holds up, wingless (0.42 .. 0.97). spoiler: extra from spoilers and fins (0..0.1).
export const holdFrac = (mass, shape, spoiler = 0) => clamp(shape * massShare(mass) + spoiler, HOLD_MIN, HOLD_MAX);
// The "aero" number shown in the Workshop: 0..100 for the body, each wing adds 25.
export const aeroScore = (mass, shape, wings = 0, spoiler = 0) => Math.round(holdFrac(mass, shape, spoiler) * 100) + wings * 25;

function aeroOf(v) {
  const mass = v.mass + (v.loadMass || 0) * 0.5;
  if (v._aeroMass !== mass) {
    const h = v.chassis.hit ? v.chassis.hit.half : [1, 0.7, 2];
    const fins = v.wingAero ? Math.min(0.1, (v.wingAero.fins || 0) * 0.05) : 0;
    v._aeroMass = mass;
    v._aero = { shape: shapeOf(h[0], h[2], !!v.stats.bike), hold: holdFrac(mass, shapeOf(h[0], h[2], !!v.stats.bike), fins) };
  }
  return v._aero;
}

// Tank drain multiplier while turbo burns in the air (physics.js). wingK: the wings' own saving (WING_TURBO_DRAIN).
export const airDrain = (v, winged, wingK) => (mode.drain * (winged ? wingK : 1)) / (TANK_TIER[v.tankTier || v.turboTier || 1] || 1);

// Adds the air turbo forces. a0: the old air push (m/s2). speed: along the nose; topMs: the car's top speed.
export function airTurbo(v, force, fwd, speed, topMs, a0, gravity, winged) {
  const fade = winged
    ? (mode.jet > 1 ? clamp(1 - (Math.max(0, speed) / (topMs * 1.9)) ** 2, 0.12, 1) : 1) // round 14: tails off, never runs away
    : FEEL.turboAirWingless * turboGain(v.vel ? v.vel.length() : speed, topMs, topMs * TURBO.speed); // by airspeed: gone at the turbo top speed, whichever way the nose points
  const a = a0 * mode.jet * fade, up = a * fwd.y;
  force.addScaledVector(fwd, a * v.mass);
  let hold = 0;
  if (!winged) {
    hold = mode.hold > 0 ? Math.min(mode.hold > 1 ? 1.06 : HOLD_MAX, aeroOf(v).hold * mode.hold) * gravity : 0;
    // A wingless car never climbs on the jet: the nose-up part of the thrust is taken back out, the hold stays.
    const cap = mode.hold > 0 ? (mode.hold > 1 ? 0.25 * gravity : 0) : OLD_LIFT_CAP * gravity;
    if (up > cap) force.y -= (up - cap) * v.mass;
    force.y += hold * v.mass;
  }
  v.jet = { thrust: a, hold, t: v.airTime };
}

// For the HUD and window.scrapwake.flight.
export function flightState(v, gravity) {
  const air = v.contacts === 0, j = air && v.turboActive ? v.jet : null, a = aeroOf(v);
  const winged = !!(v.wings && v.wingAero && v.wingAero.has);
  return {
    mode: modeId, airborne: air, winged, turbo: !!v.turboActive,
    thrust: j ? +j.thrust.toFixed(1) : 0, // m/s2 along the nose
    lift: +((j ? j.hold / gravity : 0) + (v.wingLift || 0)).toFixed(2), // share of the weight carried (1 = level flight)
    hold: +a.hold.toFixed(2), aero: aeroScore(v.mass, a.shape, winged ? v.wingAero.count || 0 : 0),
    sinkRate: +(-v.vel.y).toFixed(1), // m/s, positive = coming down
    tank: +v.turbo.toFixed(2), tankTier: v.tankTier || v.turboTier || 1,
    flightSeconds: +((4 / airDrain(v, winged, 0.45)) * v.turbo).toFixed(1), // what the tank holds at this moment
    altitude: Math.round(v.wingAlt || 0), speedKmh: Math.round(v.vel.length() * 3.6), mass: Math.round(v.mass),
  };
}