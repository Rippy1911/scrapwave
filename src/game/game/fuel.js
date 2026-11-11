// Fuel for every vehicle. Runs in the controller layer each tick, after the drivers set ctl and before physics:
// drains by throttle/turbo/speed, limps an empty tank (30% throttle, no turbo, a cough now and then),
// refuels at the pumps and from jerry cans. Physics is never touched.
import { FUEL } from "@/game/data/tuning";

const RADIO = {
  low: ["Running on fumes out there. Pumps at the Well-town and both scrapyards.", "Fuel's low, driver. Grab a red can off the road or hit a pump."],
  empty: ["You're dry! Engine's limping. Crawl to a pump or find a jerry can."],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function attachFuel(game) {
  const st = game.world.fuel;
  let glugT = 0, coughT = 0;
  const radio = (key) => { game.emit({ type: "radio", from: "Well-town radio", text: pick(RADIO[key]) }); game.audio.radio(); };

  function add(v, amount) {
    const before = v.fuel;
    v.fuel = Math.min(v.fuelMax, v.fuel + amount);
    if (v.fuel > v.fuelMax * 0.3) { v.fuelWarned = false; v.fuelDry = false; }
    return v.fuel - before;
  }
  game.addFuel = add;
  game.setFuel = (v, n) => { v.fuel = Math.max(0, Math.min(v.fuelMax, n)); if (v.fuel > v.fuelMax * 0.3) { v.fuelWarned = false; v.fuelDry = false; } return v.fuel; };

  // Some wrecks drop a can.
  game.onWreckFuel = (v) => {
    if (Math.random() < FUEL.jerryDrop || v.team === "player") game.jerry.spawn(v.pos.x, v.pos.y, v.pos.z, { drop: true, vx: (Math.random() - 0.5) * 6, vz: (Math.random() - 0.5) * 6 });
  };

  game.fuelStep = (dt) => {
    const p = game.player;
    for (const v of game.vehicles) {
      if (!v.alive || v.remote) continue;
      if (!v.fuelInit) { v.fuelInit = true; if (v !== p) v.fuel = v.fuelMax * (FUEL.aiStart[0] + Math.random() * (FUEL.aiStart[1] - FUEL.aiStart[0])); }
      const c = v.ctl, speed = v.vel.length();
      // Drain: throttle (or coasting/idle), turbo x3, efficient engine x0.75.
      const load = c.throttle > 0 ? c.throttle : speed > 3 ? FUEL.coastBurn : FUEL.idleBurn;
      if (!game.ruleSys || game.ruleSys.fuelOn()) v.fuel = Math.max(0, v.fuel - FUEL.burn * load * (v.turboActive ? FUEL.turboMul : 1) * v.fuelUse * dt);
      // Limp mode: scale throttle and block turbo before physics reads ctl.
      v.limp = v.fuel <= 0;
      if (v.limp) {
        v.cough = (v.cough || 0) - dt;
        if (v.cough <= -1.6 - Math.random()) v.cough = 0.18;
        c.throttle = Math.min(c.throttle, v.cough > 0 ? 0 : FUEL.limpThrottle);
        c.turbo = false;
      }
      // Pumps: stop inside the ring to fill.
      const s = st.nearest(v.pos.x, v.pos.z);
      v.refuelling = false;
      if (s && Math.hypot(s.x - v.pos.x, s.z - v.pos.z) < FUEL.pumpRadius && speed < FUEL.stopSpeed && v.fuel < v.fuelMax - 0.01) {
        add(v, FUEL.fillRate * dt);
        v.refuelling = true; s.filling = 1;
        if (v === p) { glugT -= dt; if (glugT <= 0) { glugT = FUEL.glugEvery; game.audio.glug(); } if (v.fuel >= v.fuelMax - 0.01) { game.callout("TANK FULL", null, "#7fe0a0"); game.audio.pickup(); } }
      }
      // Jerry cans.
      for (const can of [...game.jerry.list]) {
        if (can.g.position.distanceToSquared(v.pos) > 12 || v.fuel >= v.fuelMax - 0.5) continue;
        const got = add(v, can.amount);
        game.jerry.take(can);
        if (v === p) { v.canFlash = 1.4; game.audio.glug(); game.audio.glug(); game.emit({ type: "minor", text: `+${Math.round(got)} FUEL` }); }
      }
    }
    if (!p.alive || game.autopilot) return;
    p.canFlash = Math.max(0, (p.canFlash || 0) - dt);
    const k = p.fuel / p.fuelMax;
    if (k <= FUEL.low && !p.fuelWarned) { p.fuelWarned = true; radio("low"); }
    if (p.limp && !p.fuelDry) { p.fuelDry = true; radio("empty"); game.callout("OUT OF FUEL", "limp mode · 30% throttle", "#ff8a3a"); game.audio.sputter(); }
    if (p.limp) { coughT -= dt; if (coughT <= 0 && p.ctl.throttle > 0) { coughT = 1.8 + Math.random(); game.audio.sputter(); } }
  };
}