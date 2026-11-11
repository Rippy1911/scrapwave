// Every gameplay number lives here. Units: metres, seconds, kg, km/h where noted.
export const GAME_TITLE = "Scrapwave";
export const VERSION = "1.0.0";
export const SAVE_KEY = "scrapwake-save-v1";

export const WORLD = {
  size: 1200, half: 600, seg: 256, bound: 588,
  gravity: 15, seed: 1337,
  fogDensity: 0.0012, sunElevation: 12, sunAzimuth: 235,
  noFireRadius: 60, townBankRadius: 45, baseBankRadius: 14,
};

// Vehicle physics on Rapier (src/game/vehicles/physics.js, rapier.js). Forces are per kg (m/s^2) unless noted.
export const PHYSICS = {
  hz: 60, maxFrameDt: 0.1, maxSteps: 5,
  // Suspension (ray-cast vehicle): sag at rest (m), damping ratios for bump and rebound, force cap in static loads.
  staticComp: 0.15, zetaComp: 0.6, zetaRelax: 0.85, maxSusLoad: 6,
  // Tyres: traction = grip x frictionSlip; the handbrake drops rear traction for drifts.
  frictionSlip: 1.05, sideStiffness: 1, handbrakeGrip: 0.4, handbrakeSide: 0.6,
  // Body: centre of mass sits comDrop x half-height below the hitbox centre; inertia of the hitbox box x inertiaMul.
  comDrop: 0.6, inertiaMul: 1.3, bodyRound: 0.18,
  linDamp: 0.02, groundAngDamp: 1.5, airAngDamp: 0.1,
  drag: 0.00055, rolling: 0.3, engineBrake: 1.4, reverseSpeed: 9, wreckBrake: 4,
  downforce: 0.0025, steerRate: 5,
  // Collisions: walls and props glance (low friction) and bump (some restitution) instead of stopping dead.
  bodyFriction: 0.3, bodyRestitution: 0.2, staticFriction: 0.3, staticRestitution: 0.2,
  groundFriction: 0.6, groundRestitution: 0.05,
  impactForcePerKg: 40, impactDamageMin: 7, landingDamageMin: 16, impactDamageScale: 3.2, impactCooldown: 0.2,
  // Air control: W/S pitch and A/D roll (not the arrows), Q/E yaw (rad/s^2), capped at airMaxRate (rad/s). Space levels.
  // Round 16: Q/E yaw at 65% of 4 / 3 (W/S and A/D rates live in vehicles/feel.js).
  airPitch: 5, airRoll: 6, airYaw: 2.6, airMaxRate: 2, airDamp: 6, airLevel: 6, airAutoLevel: 1.2,
  // Flips: auto-right when upside down (up.y < rightUpY) and slower than rightSpeed for rightAfter s;
  // the righting itself is a rightTime s lift-and-turn. R does it at once with a resetCooldown.
  rightUpY: 0.4, rightSpeed: 5, rightAfter: 1.2, rightTime: 0.6, rightLift: 0.9,
  resetHold: 0, resetCooldown: 1,
  maxSpeed: 120, maxSpin: 22,
};

// Stuck detection (all vehicles). See src/game/vehicles/unstick.js.
export const UNSTICK = { speedKmh: 3, pushAfter: 2, resetAfter: 4, pushDist: 2, pushUp: 0.5 };

// Attract / autopilot / hints / first minute.
export const FLOW = {
  attractIdle: 15, introSwoop: 2, autopilotIdleMax: 3, hintTime: 6,
  rampHintDist: 100, bankAt: 180, huntCargoRange: 400, maxHunters: 2,
};

// Turbo: engine force x force, top speed x speed, plus a push (m/s^2) and a kick (m/s) when it lights. Round 16: the
// extra is full at launch and fades with speed (vehicles/feel.js turboGain); speed 1.35 -> 1.2, so it tops out about
// 20% over the plain top speed instead of 35%.
// In the air it thrusts along the nose at airThrust x the ground turbo force (vehicles/feel.js scales it, caps its lift and sets the air drain).
export const TURBO = {
  force: 1.6, speed: 1.2, drainTime: 4, push: 3, kick: 1, airThrust: 0.6,
  refillSpeed: 28, refillRate: 0.035, airRefill: 0.1,
  stuntRefill: 0.2, wreckRefill: 0.35, cleanRefill: 0.3,
};

export const AIR = {
  minCallout: 0.8,
  cleanAngle: 25, scrapPerSec: 10, flipScrap: 40, rollScrap: 30,
  badLandingDmg: 5, deathFromAbove: 350,
};

export const CAMERA = {
  fovMin: 65, fovMax: 80, turboFov: 6,
  car: { dist: 7, height: 2.6 }, bus: { dist: 11, height: 4 },
  follow: 7, shakeDecay: 1.5, maxShake: 0.55, idleRecenter: 1.2,
};

// Physics + stats per chassis. accel in m/s^2, topSpeed km/h.
export const VEHICLES = {
  jackal: { name: "Jackal", kind: "car", topSpeed: 150, mass: 900, hull: 450, load: 450, cargo: 1,
    accel: 10, brake: 16, grip: 1.25, steerMax: 0.6, steerMin: 0.15, price: 0, cam: "car" },
  brawler: { name: "Brawler", kind: "car", topSpeed: 130, mass: 1500, hull: 700, load: 900, cargo: 2,
    accel: 8.5, brake: 15, grip: 1.15, steerMax: 0.55, steerMin: 0.14, price: 0, cam: "car" },
  mammoth: { name: "Mammoth", kind: "bus", topSpeed: 90, armouredTop: 80, mass: 9000, hull: 900, hullMax: 3600, load: 3000, cargo: 6,
    accel: 5, brake: 9, grip: 1.05, steerMax: 0.42, steerMin: 0.12, price: 2500, cam: "bus" },
  buggy: { name: "Rattler Buggy", kind: "car", topSpeed: 125, mass: 800, hull: 260, load: 400, cargo: 1,
    accel: 9, brake: 15, grip: 1.15, steerMax: 0.6, steerMin: 0.16, cam: "car" },
  pickup: { name: "Rattler Pickup", kind: "car", topSpeed: 115, mass: 1700, hull: 480, load: 900, cargo: 2,
    accel: 7, brake: 13, grip: 1.1, steerMax: 0.5, steerMin: 0.14, cam: "car" },
  tanker: { name: "Cisterner Tanker", kind: "bus", topSpeed: 60, mass: 11000, hull: 1400, load: 6000, cargo: 6,
    accel: 3.5, brake: 7, grip: 1.05, steerMax: 0.4, steerMin: 0.12, cam: "bus" },
  // Motorbikes (src/game/workshop/bike.js): mass includes the rider and the 60 kg tail turret mount. lean: visual lean
  // into turns (rad at full steer and speed); wheelie: nose-up on throttle (rad). dropSlot: the trap drop slot (Main).
  dirtbike: { name: "Dirt Bike", kind: "bike", topSpeed: 165, mass: 130, hull: 170, load: 200, cargo: 1,
    accel: 15, brake: 18, grip: 1.3, steerMax: 0.62, steerMin: 0.1, price: 600, cam: "car", bike: true, dropSlot: true, lean: 0.55, wheelie: 0.42 },
  chopper: { name: "Chopper", kind: "bike", topSpeed: 180, mass: 260, hull: 260, load: 300, cargo: 1,
    accel: 12.5, brake: 15, grip: 1.22, steerMax: 0.5, steerMin: 0.08, price: 1100, cam: "car", bike: true, dropSlot: true, lean: 0.5, wheelie: 0.3 },
  sidecar: { name: "Sidecar Rig", kind: "bike", topSpeed: 145, mass: 340, hull: 320, load: 360, cargo: 2,
    accel: 10.5, brake: 15, grip: 1.2, steerMax: 0.5, steerMin: 0.12, price: 900, cam: "car", bike: true, dropSlot: true, lean: 0, wheelie: 0.15 },
  bulwark: {
    name: "Bulwark", class: "tank", kind: "bus", topSpeed: 40, mass: 13500, hull: 2100, load: 4500, cargo: 2,
    accel: 1.48, brake: 18, grip: 1.38, steerMax: 0.55, steerMin: 0.55, price: 3200, cam: "bus",
  },
};

// Bulwark tank family (skid-steer tracks, hull cannon, directional armour).
export const TANK = {
  traverse: [35, 50, 65],
  offRoadTop: 28,
  trackGrip: 1.05,
  sideGrip: 2.4,
  yawDamp: 14,
  spin360: 5,
  ramSpeedCap: 42,
  pitchMin: -8,
  pitchMax: 25,
  armourMul: { front: 1, left: 0.7, right: 0.7, rear: 0.5, top: 0.4 },
  mgVsTank: 0.25,
};

export const OVERLOAD_MAX_PENALTY = 0.4; // at double load

export const WEAPONS = {
  mg: { name: "Twin MG", size: "S", kind: "hitscan", dps: 70, rate: 12, range: 160, spread: 0.012, tracerEvery: 3, mass: 60, price: 300 },
  scatter: { name: "Scattergun", size: "S", kind: "pellets", pellets: 8, dmg: 22, reload: 1.1, range: 35, spread: 0.07, mass: 80, price: 450 },
  rockets: { name: "Rocket Pod", size: "M", kind: "rocket", count: 4, dmg: 90, splash: 4, range: 220, reload: 7, speed: 80, gap: 0.12, mass: 140, price: 700 },
  harpoon: { name: "Harpoon", size: "M", kind: "harpoon", dmg: 60, speed: 95, range: 70, reload: 4, tether: 3, yankBelow: 0.35, mass: 120, price: 650 },
  flamer: { name: "Flamer", size: "M", kind: "flame", dps: 50, range: 25, burnDps: 15, burnTime: 4, cone: 0.28, mass: 110, price: 600 },
  autocannon: { name: "Autocannon", size: "L", kind: "shell", dps: 110, rate: 3, splash: 1, range: 260, speed: 240, mass: 380, price: 1400 },
  cannon: { name: "Hull Cannon", size: "L", kind: "cannon", dmg: 110, reload: 3.5, splash: 4, range: 240, speed: 95, drop: 9.8, knock: 22000, mass: 450, price: 1800 },
  // Walker frames only (size "X": no car mount takes them; the Workshop's heavy walker mount does). Tier I-III via tierDef.
  // The ram fist ("fist") is swung by src/game/mech/fist.js on the gun trigger; the others fire through combat.js.
  rocketRack: { name: "Shoulder Rocket Rack", size: "X", kind: "rocket", count: 6, dmg: 95, splash: 4.5, range: 240, reload: 8, speed: 85, gap: 0.1, mass: 420, price: 1800, walker: true },
  armCannon: { name: "Arm Cannon", size: "X", kind: "shell", dps: 150, rate: 0.9, splash: 2.6, range: 280, speed: 200, mass: 520, price: 2000, walker: true },
  twinAuto: { name: "Twin Autocannon", size: "X", kind: "shell", dps: 170, rate: 5, splash: 0.9, range: 260, speed: 250, mass: 600, price: 2200, walker: true },
  ramFist: { name: "Ram Fist", size: "X", kind: "fist", dmg: 170, reload: 1.1, range: 5.5, dps: 155, push: 9, mass: 350, price: 1500, walker: true },
};
export const RAM = { maxDmg: 400, selfReduce: 0.6, mass: 90, price: 350 };
export const MINES = { arm: 1, dmg: 320, splash: 5, cooldown: 2.5, count: 4, life: 60, mass: 70, price: 400 };

// Armour plates (hp and mass per zone) in the three upgrade tiers. The ids stay, so saved garages keep loading.
export const ARMOUR_TIERS = [
  { id: "scrap", tier: 1, name: "Scrap", hp: 150, mass: 80, price: 150 },
  { id: "plate", tier: 2, name: "Welded", hp: 185, mass: 160, price: 375 },
  { id: "forged", tier: 3, name: "War-forged", hp: 222, mass: 220, price: 900 },
];

// Upgrade tiers (src/game/workshop/tiers.js). cost: price x the Tier I price; stat: the upgrade's main number
// (damage, HP, power, grip, boost); mass: armour, rams and structure get heavier. Unlocks: jobs + contracts completed
// (save.stats.jobsDone) or story progress = lifetime banked scrap / STORY.banked.
export const UPGRADE_TIERS = [
  { tier: 1, roman: "I", name: "Scrap", cost: 1, stat: 1, mass: 1, unlock: null },
  { tier: 2, roman: "II", name: "Welded", cost: 2.5, stat: 1.22, mass: 1.15, unlock: { jobs: 15, story: 0.4, storyLabel: "10,000 scrap banked in total" } },
  { tier: 3, roman: "III", name: "War-forged", cost: 6, stat: 1.48, mass: 1.3, unlock: { jobs: 40, story: 1, storyLabel: "25,000 scrap banked in total" } },
];
export const STORY = { banked: 25000 };
// Weapon tier entries [I, II, III]: damage per second, reach (range, splash, projectile speed, flame cone), reload, heat.
// Reload weapons get dmg x stat x reload, so their damage per second also lands on the tier's stat step.
export const TIER_WEAPON = { dmg: [1, 1.22, 1.48], range: [1, 1.08, 1.15], reload: [1, 0.92, 0.85], heat: [1, 0.88, 0.76] };
// Tier I prices of the upgrades that are not parts of their own (garage cars and bikes).
export const UPGRADES = {
  engine: { name: "Engine", price: 400, desc: "power" }, tyres: { name: "Tyres", price: 300, desc: "grip" },
  turbo: { name: "Turbo", price: 350, desc: "boost" }, tank: { name: "Fuel tank", price: 200, desc: "capacity" },
  turret: { name: "Tail turret", price: 250, desc: "damage" },
  traverse: { name: "Turret traverse", price: 280, desc: "°/s" },
};
// Bikes: the tail turret, getting thrown off (impact hull loss with a car near, hard landings, rolling over) and the respawn.
export const BIKE = {
  turret: { name: "Tail Turret", size: "S", kind: "hitscan", dps: 20, rate: 4, range: 45, spread: 0.035, tracerEvery: 1, mass: 60, price: 0 },
  turretArc: 0.35, turretScale: 0.6,
  knockDmg: 18, knockNear: 8, landAir: 1.2, landUp: 0.8, rollOver: 0.35, rollTime: 0.3,
  respawn: 3, respawnDist: 7, roll: 14, rollDamp: 6, wheelieMin: 4, wheelieMax: 26,
};
export const MODULES = {
  nitro: { name: "Nitro Boost", desc: "Turbo refills 50% faster", mass: 40, price: 500 },
  welder: { name: "Welder", desc: "Repairs 25 HP/s out of combat", mass: 60, price: 700 },
  smoke: { name: "Smoke", desc: "Breaks lock and hides you (V)", mass: 30, price: 350 },
  mines: { name: "Mine Dropper", desc: "Drop mines with G", mass: 70, price: 400 },
  bigtank: { name: "Long-range Tank", desc: "+50% fuel capacity", mass: 50, price: 450 },
  efficient: { name: "Efficient Engine", desc: "Burns 25% less fuel", mass: 20, price: 550 },
};

// Fuel, forgiving: a full tank is ~6 min of normal driving; empty = limp mode, never stranded.
export const FUEL = {
  tank: 100, burn: 100 / 360, coastBurn: 0.3, idleBurn: 0.08, turboMul: 3,
  low: 0.15, limpThrottle: 0.3, bigTankMul: 1.5, efficientMul: 0.75,
  pumpRadius: 9, stopSpeed: 2.5, fillRate: 22, glugEvery: 0.32,
  jerry: 35, jerryCount: 16, jerryRespawn: 75, jerryDrop: 0.4,
  aiLow: 0.22, aiStart: [0.35, 1],
};

// Rolling replay buffer and instant replays.
// Replays play at 1x: the game has no slow motion anywhere.
export const REPLAY = { hz: 30, keep: 30, length: 10, offerTime: 6, minAir: 1.5 };

// Demo reel: a 2-minute autopilot show reel (also the title attract mode).
export const DEMO = { length: 120, cutMin: 3, cutMax: 5.5 };

export const DAMAGE = {
  zones: ["front", "rear", "left", "right", "top"],
  smokeWhite: 0.6, smokeBlack: 0.3, flames: 0.1,
  partLife: 20, wreckLife: 30, wheelLossSpeed: 0.75,
  explosionRadius: 10, explosionDamage: 160, explosionImpulse: 9000,
  barrelRadius: 7, barrelDamage: 120, combatTimeout: 5,
  repairRate: 40, welderRate: 25,
  spillFraction: 0.6, respawnTime: 5, burnTrail: true,
};

export const AI = {
  thinkHz: 4, farDist: 300, farThinkHz: 1,
  drifters: 10, rattlers: [8, 12], packSize: [2, 4],
  skills: {
    rookie: { spread: 0.06, react: 0.7, aggression: 0.45, turbo: 0.3 },
    veteran: { spread: 0.035, react: 0.4, aggression: 0.65, turbo: 0.6 },
    ace: { spread: 0.018, react: 0.2, aggression: 0.85, turbo: 0.9 },
  },
  engageRange: 140, fleeHull: 0.25, respawnDelay: 12, minSpawnDist: 220,
  stuckTime: 2, raidInterval: 360, convoyInterval: 300, warlordAfter: 900,
};

// AI gunnery (ai/aim.js). Pairs [rookie, ace] are blended by skill q (0 rookie, 0.5 veteran, about 0.85 ace).
export const AIM = {
  losEvery: 0.2, forget: 1.5, // line of sight re-checked this often (s); a target unseen this long needs a new reaction
  react: [0.6, 0.3], reactJitter: 0.08, // first sight to first shot (s)
  // aim error (rad, sd per axis): err x (1.4 - 0.7 q) + errPerM x distance + errPerMs x target speed x (1.5 - q)
  err: 0.018, errPerM: 0.0001, errPerMs: 0.0018, errUp: 0.6, errEvery: [0.25, 0.5],
  lag: [0.2, 0.1], // hitscan aims where the target was this long ago (s)
  lead: [0.55, 0.9], // projectiles get this share of the true lead (+-0.2)
  burst: [0.45, 0.9], pause: [0.9, 0.45], // trigger held / released (s, +-30 %)
  turretQ: 0.45, // base turrets aim like a middling driver
};

export const ECONOMY = {
  rattlerWreck: [30, 60], drifterWreck: 120, tankerWreck: [400, 700], lootPile: [20, 80],
  crateScrap: [25, 70], upgradeCost: [200, 500, 1100, 2300], startScrap: 400,
  rarities: [
    { id: "rusty", name: "Rusty", color: "#9ca3af", mul: 1 },
    { id: "salvaged", name: "Salvaged", color: "#4ade80", mul: 1.15 },
    { id: "forged", name: "Forged", color: "#60a5fa", mul: 1.3 },
    { id: "relic", name: "Relic", color: "#facc15", mul: 1.5 },
  ],
  levelMul: 0.08, // per level above 1
};

export const CYCLE = {
  length: 1800, shortLength: 900, storm: 300,
  warnings: [1500, 1740], stormDps: 30, stormMinRadius: 90,
};

export const BASE = {
  plotSize: 60, claimTime: 5, grid: 2, siphonRange: 15, siphonTime: 8, siphonShare: 0.25,
  modules: {
    rig: { name: "Rig", hp: 3000, cost: 0, size: [6, 6] },
    scrapwall: { name: "Scrap Wall", hp: 500, cost: 40, size: [2, 1] },
    platewall: { name: "Plate Wall", hp: 1100, cost: 120, size: [2, 1] },
    spikewall: { name: "Spike Wall", hp: 900, cost: 100, size: [2, 1] },
    gate: { name: "Gate", hp: 1200, cost: 150, size: [4, 1] },
    mgturret: { name: "MG Turret", hp: 800, cost: 250, size: [2, 2], dps: 60, range: 120 },
    rocketturret: { name: "Rocket Turret", hp: 800, cost: 450, size: [2, 2], dmg: 80, range: 200, reload: 5 },
    flametrap: { name: "Flame Trap", hp: 600, cost: 200, size: [2, 2], dps: 45, range: 8 },
    garagepad: { name: "Garage Pad", hp: 1000, cost: 300, size: [6, 6], repair: 40 },
    refinery: { name: "Refinery", hp: 1000, cost: 350, size: [4, 4], rate: 4 },
    radar: { name: "Radar Mast", hp: 500, cost: 150, size: [2, 2], range: 300 },
  },
};

export const JOBS = {
  maxActive: 2, offerEvery: 70,
  defs: {
    escort: { title: "Escort the Cisterners", reward: 300, time: 240 },
    crash: { title: "Haul the crash-site crate", reward: 250, time: 240 },
    dump: { title: "Burn the Rattler fuel dump", reward: 200, time: 200 },
    tower: { title: "Hold the Radio Tower 60s", reward: 200, time: 200, hold: 60 },
    hunt: { title: "Wreck 3 Rattlers", reward: 180, time: 180, count: 3 },
  },
};

export const CONTRACTS = [
  { id: "wheels", text: "Rip 5 wheels off", goal: 5, reward: 400 },
  { id: "jumps", text: "Land 10 jumps over 1.5 s", goal: 10, reward: 500 },
  { id: "wrecks", text: "Wreck 12 vehicles", goal: 12, reward: 450 },
  { id: "bank", text: "Bank 1,500 scrap", goal: 1500, reward: 400 },
  { id: "parts", text: "Shoot off 20 parts", goal: 20, reward: 350 },
  { id: "flips", text: "Pull 5 flips or barrel rolls", goal: 5, reward: 300 },
  { id: "barrels", text: "Blow up 8 fuel barrels", goal: 8, reward: 300 },
  { id: "convoy", text: "Destroy 2 convoy tankers", goal: 2, reward: 600 },
];

// Render presets. ao: 0 off, 1 half-res fast (8 samples), 2 half-res (16), 3 full-res (64). lod scales model detail distances,
// atmos scales dust, smoke and birds. "ultra" is picked by the auto-detect only for strong desktop GPUs.
export const QUALITY = {
  low: { shadows: false, shadowSize: 1024, shadowRange: 60, bloom: false, smaa: false, ao: 0, particles: 0.45, scatter: 0.45, far: 900, pixelRatio: 1, lod: 0.55, terrain: 0, shimmer: false, atmos: 0.35 },
  medium: { shadows: true, shadowSize: 2048, shadowRange: 80, bloom: true, smaa: true, ao: 0, particles: 0.75, scatter: 0.75, far: 1400, pixelRatio: 1.25, lod: 0.8, terrain: 1, shimmer: false, atmos: 0.7 },
  high: { shadows: true, shadowSize: 4096, shadowRange: 100, bloom: true, smaa: true, ao: 1, particles: 1, scatter: 1, far: 1800, pixelRatio: 1.5, lod: 1, terrain: 1, shimmer: true, atmos: 1 },
  ultra: { shadows: true, shadowSize: 4096, shadowRange: 150, bloom: true, smaa: true, ao: 3, particles: 1, scatter: 1, far: 2200, pixelRatio: 2, lod: 1.5, terrain: 1, shimmer: true, atmos: 1.3 },
};

// Look of the basin. The sun matches the quarry_01 HDRI azimuth (54 deg) so image-based light and the sun agree;
// it sits a little higher than the HDRI's 10 deg so flat ground still reads in the late-afternoon light.
export const RENDER = {
  sunElevation: 17, sunAzimuth: 54, sunColor: [1.0, 0.8, 0.56], sunIntensity: 3.6,
  exposure: 0.9, envIntensity: 0.75, hdri: "/assets/hdri/quarry_01_1k.hdr", hdriClamp: 5,
  hemiSky: "#a7c0d8", hemiGround: "#9a6c48", hemiIntensity: 0.42,
  fog: { color: "#d6b694", sunTint: [1.25, 1.02, 0.78], density: 0.0014, falloff: 0.018, base: 4, start: 60, max: 0.94 },
  sky: { turbidity: 2.6, rayleigh: 1.9, mie: 0.0028, mieG: 0.76, gain: 0.8, disc: 0.99985, discSoft: 0.00012, discGain: 2.2, haze: 0.85 },
  bloom: { threshold: 1.25, smoothing: 0.35, intensity: 0.85, radius: 0.72 },
};