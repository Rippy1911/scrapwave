// Game assembly: scene, world, vehicles, systems, fixed-step simulation and the render frame.
import * as THREE from "three";
import { createRenderer } from "@/game/render/renderer";
import { createSky } from "@/game/render/sky";
import { createSkyCycle } from "@/game/world/sky/skyCycle";
import { createTextures, setAnisotropy } from "@/game/render/textures";
import { createMaterials } from "@/game/render/materials";
import { createChaseCam } from "@/game/render/camera";
import { createCineCam } from "@/game/render/cinecam";
import { createDebugOverlay } from "@/game/render/debug";
import { buildWorld } from "@/game/world/world";
import { buildFuelStations } from "@/game/world/fuelStations";
import { createPlaceLabels } from "@/game/world/placeLabels";
import { createParticles } from "@/game/fx/particles";
import { createEffects, createPickups } from "@/game/fx/effects";
import { preloadShells } from "@/game/vehicles/shells";
import { createJerryCans } from "@/game/fx/jerrycans";
import { createDust } from "@/game/render/dust";
import { tickWind } from "@/game/render/wind";
import { onFrame, onQuality } from "@/game/render/frame";
import { createTumbleweeds } from "@/game/world/tumbleweeds";
import { createCombat } from "@/game/weapons/combat";
import { createAudio } from "@/game/audio/audio";
import { createInput } from "@/game/core/input";
import { createLoop } from "@/game/core/loop";
import { createAI } from "@/game/ai/ai";
import { createDrifters } from "@/game/ai/drifters";
import { createAutopilot } from "@/game/ai/autopilot";
import { syncVehicle } from "@/game/vehicles/vehicle";
import { stepVehicle } from "@/game/vehicles/physics";
import { collideAll } from "@/game/game/collideAll";
import { unstickStep } from "@/game/vehicles/unstick";
import { updateTags } from "@/game/vehicles/nametag";
import { controlPlayer, updateAim } from "@/game/game/player";
import { attachPlayerCar } from "@/game/game/playerCar";
import { attachRules } from "@/game/game/rules";
import { attachFuel } from "@/game/game/fuel";
import { createHints } from "@/game/game/hints";
import { buildHud } from "@/game/game/hud";
import { installHooks } from "@/game/game/hooks";
import { setupTest, testStep, testProps, setupAccel, accelStep } from "@/game/game/testmode";
import { setupSelfCheck, selfCheckStep } from "@/game/game/selfcheck";
import { createRecorder } from "@/game/replay/recorder";
import { createReplay } from "@/game/replay/playback";
import { createDemo } from "@/game/demo/reel";
import { CYCLE, FLOW } from "@/game/data/tuning";
import { net } from "@/game/net/net";
import { createNetSync } from "@/game/net/sync";
import { createBase } from "@/game/base/base";
import { createBuildView } from "@/game/base/buildView";
import { createCycle } from "@/game/base/cycle";
import { createJobs } from "@/game/base/jobs";
import { checkContracts } from "@/game/base/contracts";
import { createConvoy } from "@/game/ai/convoy";
import { createWarlord } from "@/game/ai/warlord";
import { createRuleSystem } from "@/game/rules/apply";
import { getRules } from "@/game/rules/state";
import { createArena } from "@/game/arena/arena";
import { createPhoto } from "@/game/photo/photoMode";
import { createWorkshop } from "@/game/workshop/workshop";
import { createAir } from "@/game/air";
import { createTraps } from "@/game/traps/traps";
import { createPlayerAim } from "@/game/weapons/playerAim";
import { createOnFoot } from "@/game/onfoot/onfoot";
import { driveCamera } from "@/game/game/driveCamera";
import { createMech } from "@/game/mech/mech";
import { createTouch } from "@/game/ui/touch/controller";
import { createFactions } from "@/game/factions/factions";
import { createLobby } from "@/game/lobby/lobby";
import { createQuick } from "@/game/lobby/quick";
import { prewarm } from "@/game/render/prewarm";
import { attachTelemetry, modePicked, firstDrive } from "@/game/core/telemetry";
import { attachRound15 } from "@/game/game/round15";
import { createFame } from "@/game/fame/createFame";
import { installFameCheck } from "@/game/fame/fameCheck";
import { getAccessToken } from "@base44/sdk";

export async function createGame(canvas, { save, emit, onState, onProgress, modes = {} }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 1400);
  const rend = createRenderer(canvas, scene, camera, save.quality);
  setAnisotropy(Math.min(8, rend.renderer.capabilities.getMaxAnisotropy()));
  const sky = createSky(rend.renderer, scene), nSky = scene.children.length; // everything added after this is free roam
  onProgress(0.1, "Painting rust...");
  const T = createTextures();
  const M = createMaterials(T);
  const shellsP = preloadShells(); // loads alongside the world
  const world = await buildWorld(scene, T, M, rend.q, onProgress, { extraProps: modes.test ? testProps : null });
  // Kenney car bodies for the vehicle shells: wait for them (bounded) so the first cars are built with them.
  await Promise.race([shellsP, new Promise((r) => setTimeout(r, 12000))]);
  world.fuel = buildFuelStations(scene, M, world);
  const labels = createPlaceLabels(scene, world);
  onProgress(0.88, "Fuelling the Rattlers...");

  const game = {
    scene, camera, rend, sky, T, M, world, vehicles: [], time: 0, save, emit, uiOpen: false, modes,
    debug: !!modes.debug, noSave: !!(modes.autoplay || modes.test || modes.selfcheck || modes.mechcheck || modes.famecheck), cycle: { t: 0, length: CYCLE.length }, introT: 0, attract: false,
    mapTarget: null, roamObjects: scene.children.slice(nSky), // the free-roam world's meshes: hidden while another map is loaded
  };
  game.particles = createParticles(scene, (x, z, y) => (game.world ? game.world.groundAt(x, z, y) : y - 1));
  game.fx = createEffects(scene, M, world);
  // Living world (render only, no gameplay or colliders): wind-blown dust sheets, dust devils, dust puffs, and
  // tumbleweeds that roll downwind and burst when a car hits them. Everything that drifts reads render/wind.js.
  game.dust = createDust(scene, world.terrain, sky);
  game.skyCycle = createSkyCycle(game); // round 14: hour of day, night, weather
  game.weeds = createTumbleweeds(scene, world.terrain, () => game.vehicles, game.dust);
  const offLiving = [
    onQuality((q) => { game.dust.setQuality(q); game.weeds.setQuality(q); }),
    onFrame((cam, dt, time) => {
      if (!cam) return;
      dt = Math.min(dt, 0.1);
      tickWind(time);
      game.dust.update(cam, dt, time);
      game.weeds.update(cam, dt);
    }, scene),
  ];
  game.pickups = createPickups(scene, M);
  game.jerry = createJerryCans(scene, M);
  game.audio = createAudio();
  game.rec = createRecorder(game); game.replay = createReplay(game, game.rec);
  game.combat = createCombat(game);
  game.ai = createAI(game); game.drifters = createDrifters(game);
  game.autopilotCtl = createAutopilot(game);
  game.input = createInput(); game.cam = createChaseCam(camera); game.cine = createCineCam(camera, game.cam);
  attachRules(game); attachFuel(game);
  game.hints = createHints(game); game.demo = createDemo(game, modes);
  const makePlayer = attachPlayerCar(game);
  game.netSync = createNetSync(game);
  createBase(game); // plots, modules, turrets, raids (wraps game.onWreck after the net layer)
  game.buildView = createBuildView(game); game.cycleSys = createCycle(game);
  game.jobs = createJobs(game); game.convoy = createConvoy(game); game.warlord = createWarlord(game);
  game.ruleSys = createRuleSystem(game); // rules multipliers + wraps (AI count, building)
  createArena(game); // game.arena, game.horde
  createWorkshop(game); // game.workshop: built designs, upgrade tiers, bikes
  createAir(game); // game.air (helicopter, admin jet), game.adminActions
  createTraps(game); // game.traps: rear drop slot (G/H), trap shop (U), oil spots
  game.playerAim = createPlayerAim(game); // assisted (default) or manual aim
  createOnFoot(game); // game.onfoot: safe zones, the scavenger, free cars, Choose your ride (wraps respawn/onWreck)
  createMech(game); // game.mech: joints on 1-9, poses, T transform, the walker, footprints, the ram fist
  game.touch = createTouch(game); // touch controls (phones, tablets, ?touch=1); off = input unchanged
  game.photo = createPhoto(game); // photo mode (O)
  createFactions(game); // game.factions: reputation, traders, faction jobs, militia guards, town gates
  createFame(game, { isAuthed: () => !!getAccessToken() });
  createLobby(game); // game.lobby: custom-game lobbies other players join (wraps onWreck and emit last)
  createQuick(game); // game.quick: the title's Quick play, online (joins or hosts a lobby, bots fill it)
  offLiving.push(attachTelemetry(game)); // crash reports and play events, batched (core/telemetry.js; sees every emit)
  const r15 = attachRound15(game, modes); // round 15: map worlds, races, stunt parks, admin tools, the bike check
  game.base.start(null);
  let contractT = 2;

  // Initial population
  makePlayer(game.spawnPose());
  if (modes.test) setupTest(game);
  else if (!modes.bikecheck && !modes.tankcheck) { game.ai.populate(); game.drifters.populate(); } // scripted checks drive alone
  if (modes.accel) setupAccel(game);
  if (modes.autoplay) game.autopilotCtl.set(true);
  if (modes.selfcheck) setupSelfCheck(game);
  if (modes.famecheck) installFameCheck(game);
  if (modes.debug) createDebugOverlay(scene, world);
  syncVehicle(game.player, 1, 0);
  game.cam.snap(game.player);

  // 2 s swoop from above the Well-town down to the car at the gate, then "HIT THE ROAD".
  game.startIntro = (swoop = true) => {
    game.cam.snap(game.player);
    if (!swoop) { game.introT = 0; return; }
    const t = world.town.bank;
    game.cine.swoop(new THREE.Vector3(t.x + 30, world.terrain.heightAt(t.x, t.z) + 90, t.z + 60), FLOW.introSwoop);
    game.introT = FLOW.introSwoop;
  };

  const applyQuality = (q) => {
    sky.setShadows(q.shadows, q.shadowSize);
    rend.renderer.shadowMap.enabled = q.shadows;
    game.particles.setBudget(q.particles);
    world.scatter.setDensity(q.scatter);
  };
  rend.onQuality = applyQuality;
  applyQuality(rend.q);

  function step(dt) {
    if (game.replay.active) return; // replays hold the simulation; it resumes exactly where it stopped
    game.input.update();
    if (game.replay.offer() && game.input.peekEdge("smoke")) { game.input.edge("smoke"); game.replay.start(); return; }
    game.time += dt;
    game.cycle.t += dt;
    for (const v of game.vehicles) { v.prevPos.copy(v.pos); v.prevQuat.copy(v.quat); }
    const onFoot = game.onfoot.control(dt); // E out / in, walking; while on foot the car stays parked
    const p = game.player; // after control(): getting into another car changes the player's car
    if (onFoot) {
      Object.assign(p.ctl, { throttle: 0, brake: 0, steer: 0, handbrake: true, turbo: false, fire: false, rockets: false, harpoon: false });
    } else if (game.introT > 0) {
      game.introT -= dt;
      Object.assign(p.ctl, { throttle: 0, brake: 0, steer: 0, handbrake: true, turbo: false, fire: false, rockets: false, harpoon: false });
      if (game.introT <= 0) { game.callout("HIT THE ROAD", null, "#f2c230"); game.audio.callout(); }
    } else if (p.alive && game.buildView.active) {
      Object.assign(p.ctl, { throttle: 0, brake: 1, steer: 0, handbrake: true, turbo: false, fire: false, rockets: false, harpoon: false });
    } else if (p.alive) {
      if (!accelStep(game, dt)) { if (game.autopilot) game.autopilotCtl.step(dt); else controlPlayer(game, p, dt); }
      if (p.ctl.throttle > 0 && !game.autopilot) firstDrive();
    } else Object.assign(p.ctl, { throttle: 0, brake: 0, steer: 0, fire: false, rockets: false, harpoon: false, turbo: false });
    const arena = game.arena.active;
    if (net.isHost() && !arena) { game.ai.update(dt); game.drifters.update(dt); }
    game.fuelStep(dt); // controller layer: limp mode scales ctl before physics reads it
    game.arena.control(dt); // arena opponents drive; power-up effects (freeze) override ctl
    r15.control(dt); // round 15 controllers: stunt vents and pads, admin freeze, the bike check's driver
    game.workshop.control(dt); // tier effects (turbo boost, modules) and bikes (turret, balance, thrown rider)
    game.mech.step(dt); // moving machines: keys 1-9, T transform, walking (walkers skip car physics)
    game.air.step(dt); // aircraft fly here: their own kinematic bodies, no car physics
    game.traps.control(dt); // trap slot keys, oil grip, popped tyres, outposts restock
    game.onfoot.step(dt); // zones, weapons gate (after every controller), free cars, spawn points
    game.factions.step(dt); // reputation toasts, town gates, militia guards (host)
    game.fame?.step(dt);
    game.netSync.step(dt); // remote cars: interpolated, kinematic
    // Remote cars step too: physics.js moves them as kinematic bodies from their interpolated pose, so they collide.
    for (const v of game.vehicles) { if (v.air || v.walking) continue; stepVehicle(v, world, dt); if (!v.remote) unstickStep(game, v, dt); }
    collideAll(game);
    for (const v of game.vehicles) game.combat.fire(v, dt);
    game.combat.update(dt);
    game.rulesStep(dt);
    game.ruleSys.step();
    game.arena.step(dt);
    game.base.step(dt);
    if (!arena && !game.big.active) { game.cycleSys.step(dt); game.jobs.step(dt); game.convoy.update(dt); game.warlord.update(dt); }
    contractT -= dt;
    if (contractT <= 0 && !game.noSave && !game.demo.running) { contractT = 2; checkContracts(game); }
    game.jerry.update(dt, game);
    game.hints.step(dt);
    game.demo.step(dt);
    game.rec.step(dt);
    testStep(game, dt);
    selfCheckStep(game, dt);
    r15.step(dt);
  }

  let hudT = 0, realTime = 0;
  function frame(alpha, real) {
    realTime += real;
    const p = game.player;
    const replaying = game.replay.active && game.replay.update(game.loop.paused ? 0 : real);
    if (!replaying) driveCamera(game, p, real, alpha, realTime);
    else game.input.takeAim();
    camera.updateMatrixWorld();
    const onFoot = game.onfoot.active();
    if (!replaying && p.alive && !game.autopilot && !onFoot) game.playerAim.update(p, updateAim); // assisted lock, or the manual crosshair aim
    else { game.playerAim.hide(); p.aimFor = null; }
    updateTags(game, camera.position);
    labels.update(p.mesh.root.position, game.mapTarget);
    world.fuel.update(realTime);
    sky.update(p.mesh.root.position, camera.position);
    const sdt = game.loop.paused ? 0 : real;
    game.particles.update(sdt);
    game.fx.update(sdt, camera.position);
    game.base.frame(sdt);
    game.arena.frame(sdt); r15.frame(sdt, real);
    game.workshop.frame(real); // bike lean and wheelie
    game.mech.frame(); // walker rigs: fold, gait, joints
    game.air.frame(sdt); game.traps.frame(sdt); game.onfoot.frame(sdt, realTime);
    game.stormK = game.cycleSys.frame(sdt, camera.position);
    for (const u of world.updaters) u(real);
    if (!replaying && p.turboActive && Math.random() < 0.8) for (const f of p.mesh.flames) { const w = f.getWorldPosition(new THREE.Vector3()); game.particles.turbo(w.x, w.y, w.z); }
    game.particles.setScale(rend.renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360)));
    game.audio.setListener(camera.position);
    const kmh = p.vel.length() * 3.6;
    const rpm = Math.min(1, kmh / p.stats.topSpeed) * 0.85 + (p.ctl.throttle ? 0.15 : 0);
    game.audio.engine(rpm, p.ctl.throttle + (p.turboActive ? 0.5 : 0), p.chassis.engineSound, p.alive && !game.loop.paused && !replaying && !onFoot);
    rend.setFx({ hit: replaying ? 0 : game.hitFlash, time: realTime, speed: !replaying && p.turboActive ? 1 : 0 });
    rend.tick(game.loop.frameMs, real);
    rend.render();
    hudT -= real;
    if (hudT <= 0) { hudT = 0.1; onState(buildHud(game)); }
  }

  game.loop = createLoop({ step, frame, speed: modes.mechcheck || modes.bikecheck || modes.tankcheck ? 4 : 1 });
  rend.prewarm = await prewarm(game); // every material and effect compiled for the post chain's target (render/prewarm.js)
  onProgress(1, "Ready");

  // Title attract mode = the demo reel behind the menu. Progress made during it is discarded.
  const setAttract = (on) => (on ? game.demo.start({ attract: true }) : game.demo.stop());

  const onBlur = () => emit({ type: "pause", force: true });
  window.addEventListener("blur", onBlur);
  const removeHooks = installHooks(game, { emit });
  return {
    game,
    start() { game.loop.start(); },
    setPaused(v) { game.loop.paused = v; if (v) game.audio.suspend(); else game.audio.resume(); },
    setUiOpen(v) { game.uiOpen = v; },
    setQuality(q) { save.quality = q; save.qualityChosen = true; rend.setQuality(q); },
    setAimMode(m) { return game.playerAim.setMode(m); },
    unlockAudio() { game.audio.init(); },
    applyGarage() { game.rebuildPlayer(); },
    setAttract,
    startDemo() { game.demo.start({ attract: false }); },
    stopDemo() { game.demo.stop(); },
    replay() { return game.replay.start(); },
    // Leaving the title: fresh car at the gate, then the intro swoop (skipped for scripted modes).
    // welcome: the room server's welcome when playing online (null = single player).
    beginPlay(welcome = null) {
      setAttract(false);
      if (modes.test) return;
      game.respawnPlayer();
      game.startIntro(!modes.selfcheck && !modes.mechcheck);
      if (welcome) game.netSync.start(welcome);
      else { game.base.resetAll(false); game.cycleSys.restart(); }
      game.base.start(welcome); // bases, crates, jobs and the cycle from the welcome (or fresh offline)
      if (!welcome && getRules().mode === "arena") game.arena.start(getRules()); // arenas are single player
      else { game.arena.stop(); game.ruleSys.syncPopulation(); }
      game.onfoot.sessionStart(); // "Choose your ride" (not in arenas or scripted modes)
      modePicked(game);
    },
    rematch() { game.arena.start(getRules()); modePicked(game); },
    leaveArena() { game.arena.leave(); game.startIntro(false); },
    nextCycle() { game.cycleSys.next(); },
    sendChat(text) { game.netSync.chat(text); },
    sendEmote(id) { game.netSync.emote(id); },
    dispose() {
      game.netSync.stop(); r15.dispose();
      game.air.dispose(); game.buildView.dispose(); game.onfoot.dispose(); game.mech.dispose(); game.touch.dispose(); game.lobby.dispose();
      for (const off of offLiving) off();
      net.goOffline();
      removeHooks();
      window.removeEventListener("blur", onBlur);
      game.loop.stop(); game.input.dispose(); game.audio.dispose();
      rend.disposeResize(); rend.dispose();
    },
  };
}