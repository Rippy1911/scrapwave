// Handling feel, round 2 (owner, 10 Nov): the first moments of every input bite hard. physics.js reads these.
// Chassis stats and the base turbo numbers stay in data/tuning.js; everything here scales or replaces the
// physics-side handling only, and every vehicle (player, AI, autopilot) drives on it. Bikes (stats.bike) get the
// steering, air and turbo changes but neither the brake drift nor the front bite: their balance is bike.js's.
export const FEEL = {
  // Steering: the front wheels slew linearly to the speed-sensitive lock. Full lock in steerLockTime s, back to
  // centre in steerCentreTime s, for keyboard, pad and touch alike (the lock still shrinks with speed).
  steerLockTime: 0.11, steerCentreTime: 0.09,
  // Front tyre grip x frontGrip (rear stays 1): the nose bites at once on turn-in instead of washing wide. The extra
  // grip fades out between biteFull and biteNone of top speed, so the top end does not twitch.
  frontGrip: 1.3, biteFull: 0.6, biteNone: 0.9,

  // Air tricks, W/S pitch and A/D roll: top rate (rad/s), reached airRampTime s after key down; on release the
  // spin dies at airDamp (1/s), about 0.2 s. Q/E yaw keeps PHYSICS.airYaw / airMaxRate / airDamp.
  // Round 16 (owner, 10 Nov: "the steering mid-air is a bit too fast"): 65% of round 2's 6.9 / 8.8 rad/s. With the
  // turbo burning in the air all three rates are airTurboRate x: the jet is how you correct and steer a flight.
  airPitchRate: 4.5, airRollRate: 5.7, airRampTime: 0.13, airDamp: 15, airTurboRate: 1.25,

  // Brake drift: brake plus at least driftSteer of the steering lock, above driftMinKmh (held down to
  // driftKeepKmh), drops rear grip to driftRearGrip; it comes in over driftIn s and goes back over driftOut s.
  // While drifting the brakes keep driftBrake of their force (speed scrubs, it does not die) and the front
  // wheels counter-steer driftCounter rad per rad of slip, at most driftCounterMax rad; past driftAngle degrees of
  // slip the yaw that would open it further bleeds off at driftHold per degree per s. Straight braking is untouched.
  driftMinKmh: 50, driftKeepKmh: 35, driftSteer: 0.6, driftRearGrip: 0.65, driftIn: 0.12, driftOut: 0.3,
  driftBrake: 0.25, driftCounter: 1, driftCounterMax: 0.6, driftAngle: 30, driftHold: 1,

  // Turbo: for turboKickHold s after it lights the turbo drive is turboKick x, then it eases back to normal over
  // turboKickFade s. In the air it thrusts along the nose at turboAirMul x the old air thrust, but its upward part is
  // capped at turboAirLift x gravity (nose-up turbo still comes down), and it burns the tank at turboAirDrain x the
  // ground rate.
  turboKick: 1.5, turboKickHold: 0.45, turboKickFade: 0.15, turboAirMul: 2, turboAirLift: 0.45, turboAirDrain: 1,

  // Round 16 (owner, 10 Nov: "acceleration is a bit too fast after the first 30-50 km/h; turbo should help the first
  // acceleration and flight control, but not propel the motorcycle like a rocket").
  // Engine pull: full force up to pullFullKmh, then it falls off like a power-limited engine to pullAtTop x at the
  // top speed. The force reaches zero at pullReach x the top speed, so drag holds the top speed about where it was.
  pullFullKmh: 40, pullAtTop: 0.55, pullReach: 1.08,
  // The turbo's extra (engine boost, push and the air jet): full up to turboFullKmh, then it falls to turboAtTop x at
  // the base top speed. The turbo top speed is TURBO.speed x the top speed (data/tuning.js); in the air the jet fades
  // out from the top speed to it, so turbo never carries a car far past it. A wingless jet (bikes too) is also
  // turboAirWingless x the winged one (vehicles/turboFlight.js).
  turboFullKmh: 40, turboAtTop: 0.3, turboAirWingless: 0.5,
};

// Power-law fall-off from 1 at fullKmh to atTop at the top speed (m/s in, multiplier out).
function fallOff(speed, topMs, fullKmh, atTop) {
  const v0 = fullKmh / 3.6;
  if (speed <= v0 || topMs <= v0 * 1.05) return 1;
  return Math.pow(v0 / speed, Math.log(atTop) / Math.log(v0 / topMs));
}
// Engine force multiplier at a forward ground speed (m/s): the pull fall-off for this top speed, and the cut-off
// toward cutMs (the top speed, or the turbo top speed while it burns).
export const enginePull = (speed, topMs, cutMs = topMs) => fallOff(speed, topMs, FEEL.pullFullKmh, FEEL.pullAtTop) * Math.max(0, 1 - (Math.max(0, speed) / (cutMs * FEEL.pullReach)) ** 2);
// Share of the turbo's extra left at a forward speed (m/s); turboTopMs given, it also fades to 0 between the top speed
// and the turbo top speed (the air jet, which has no engine cut-off of its own).
export function turboGain(speed, topMs, turboTopMs = 0) {
  const k = fallOff(Math.max(0, speed), topMs, FEEL.turboFullKmh, FEEL.turboAtTop);
  if (!turboTopMs || speed <= topMs) return k;
  return turboTopMs > topMs ? k * Math.max(0, 1 - (speed - topMs) / (turboTopMs - topMs)) : 0;
}
