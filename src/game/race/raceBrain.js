// The race AI's driving decisions for one car and one step (pure maths, no three.js; race/raceDriver.js feeds it).
//  - follows the race line (race/raceLine.js): aims at a point further ahead the faster it goes, holds the line's
//    speed, brakes into the braking stretches, keeps full throttle and stays straight on a jump's run-up
//  - walls: the aim point never comes nearer the barriers than the car's half width plus a margin, and a car that
//    drifts to within a metre of one steers back toward the road and eases off
//  - obstacles near the line (track.obstacles) and slower cars or wrecks ahead: picks the side with room, moves
//    over before it gets there, and falls in behind when there is no way past
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const BRAIN = { look: 0.5, lookMin: 9, lookMax: 40, gain: 2.4, edge: 0.9, pass: 1.6, feelMin: 18, feelMax: 80, wallZone: 1.2 };

/**
 * st: this car's memory ({} to start). dt: step seconds.
 * car: { s, d (race/track.js locate), x, y, z, fx, fz (unit forward), speed (m/s), half (half width), grounded,
 *        vScale (line speed multiplier for this car and skill), vTop (m/s), bias (m: its own lane off the line) }
 * obs: [{ s, d, r, v }] things on the road: static obstacles and the other cars (v: speed along the track).
 * Returns { steer, throttle, brake, turbo, off, avoiding, vT, tx, tz }.
 */
export function planDrive(st, dt, car, track, line, obs = [], B = BRAIN) {
  const sp = car.speed, here = line.at(car.s), c0 = track.at(car.s);
  let look = clamp(B.lookMin + sp * B.look, B.lookMin, B.lookMax);
  let vT = Math.min(car.vTop, line.at(car.s + sp * 0.3).v * car.vScale);
  const jump = here.vMin > 0;
  const bias = here.jump ? 0 : car.bias || 0;
  const feel = clamp(sp * 1.7, B.feelMin, B.feelMax);

  // The nearest thing ahead that sits where this car means to drive.
  let block = null;
  for (const o of obs) {
    const ds = track.ahead(o.s, car.s);
    if (ds <= 0.5 || ds > feel) continue;
    if (o.v > sp - 1 && ds > 12) continue; // not catching it
    const need = o.r + car.half + B.pass, dl = line.at(o.s).d + bias;
    if (Math.abs(dl - o.d) < need && (!block || ds < block.ds)) block = { o, ds, need, dl };
  }
  st.passT = Math.max(0, (st.passT || 0) - dt);
  let dA = null;
  if (block) {
    const { o, ds, need, dl } = block, lim = track.at(o.s).w / 2 - car.half - B.edge;
    const right = o.d + need, left = o.d - need, okR = right <= lim, okL = left >= -lim;
    let side = st.passT > 0 ? st.pass : Math.abs(right - dl) < Math.abs(left - dl) ? 1 : -1; // keep to the side chosen
    if (side > 0 && !okR && okL) side = -1; else if (side < 0 && !okL && okR) side = 1;
    st.pass = side; st.passT = 0.8;
    dA = clamp(side > 0 ? right : left, -lim, lim);
    if (ds < look) look = Math.max(B.lookMin, ds); // be across by the time it gets there
    if (!okR && !okL) vT = Math.min(vT, o.v + ds * 0.4); // no way past: fall in behind
    if (Math.abs(car.d - o.d) < o.r + car.half + 0.2 && ds < 6 + sp * 0.5) vT = Math.min(vT, Math.max(o.v, 3) + ds * 0.5);
  }

  // Aim point: on the line `look` metres ahead, moved over for the obstacle, kept off the walls.
  const tp = line.at(car.s + look), c = track.at(car.s + look);
  let dT = tp.d + (tp.jump ? 0 : bias);
  if (dA !== null) dT += (dA - dT) * clamp((feel - block.ds) / Math.max(1, feel - look), 0, 1);
  const lim = Math.max(0, c.w / 2 - car.half - B.edge);
  dT = clamp(dT, -lim, lim);
  const tx = c.x + c.nx * dT, tz = c.z + c.nz * dT, dx = tx - car.x, dz = tz - car.z;
  const ang = Math.atan2(dx * -car.fz + dz * car.fx, dx * car.fx + dz * car.fz); // + = the aim point is to the right
  let steer = ang * B.gain;

  // Walls: within a metre of scraping one, steer back in; heading into it, slow down.
  const room = c0.w / 2 - car.half - Math.abs(car.d);
  if (room < B.wallZone && !c0.gap) {
    const k = clamp(1 - room / B.wallZone, 0, 1), out = (car.fx * c0.nx + car.fz * c0.nz) * Math.sign(car.d);
    steer -= Math.sign(car.d) * k * 0.7;
    if (out > 0.12) vT = Math.min(vT, Math.max(8, sp - 6 * k));
  }
  if (Math.abs(ang) > 0.6) vT = Math.min(vT, 12); // pointing the wrong way: sort that out first
  steer = clamp(steer, -1, 1);

  let throttle = 1, brake = 0, turbo = false;
  const over = sp - vT;
  if (over > 1.5) { throttle = 0; brake = clamp(over / 5, 0.25, 1); } else if (over > 0) throttle = 0.25;
  if (jump && !block) { brake = 0; throttle = 1; turbo = sp < here.vMin + 2; vT = Math.max(vT, here.vMin); }
  else if (vT - sp > 6 && Math.abs(ang) < 0.12 && Math.abs(tp.k) < 0.004 && !block) turbo = true;
  if (!car.grounded) { steer = 0; brake = 0; }

  const off = Math.abs(car.d) > c0.w / 2 + 5 || car.y < c0.y - 5;
  return { steer, throttle, brake, turbo, off, avoiding: !!block, vT, tx, tz };
}