// On-foot combat: the walker's health, loadout, shots, loot and death. onfoot.js owns walking, getting in and out
// and the camera, and calls control / step / frame here. Keys on foot: 1 long gun, 2 sidearm, 3 grenades, 4 C4,
// LMB fires or throws, RMB aims (the sniper scopes; Q changes the zoom step), R reloads (with C4 selected it blows
// the charges that are out). No weapons inside a safe zone. Death drops the kit as a loot bag and, after
// FOOT.respawnTime, asks for the respawn the wreck timer asks for (onDead).
import { FOOT } from "@/game/onfoot/footGear";
import { createLoadout } from "@/game/onfoot/loadout";
import { createFootHealth } from "@/game/onfoot/footHealth";
import { createFootShots } from "@/game/onfoot/footShots";
import { createFootLoot } from "@/game/onfoot/footLoot";
import { stunStep } from "@/game/onfoot/driverHit";
import { createFootFx } from "@/game/engine/three/footFx";

const SLOT_KEYS = { Digit1: "long", Digit2: "side", Digit3: "grenade", Digit4: "c4" };
const CAUSE = { "run over": "RUN OVER", fall: "A LONG FALL", blast: "BLOWN UP", horde: "TORN APART", shot: "SHOT" };

export function createFootCombat(game, { walker, cam, keys, mesh, remote, rides, onDead }) {
  const fx = createFootFx(game.scene);
  const load = createLoadout();
  const shots = createFootShots(game, fx, remote);
  const loot = createFootLoot(game, fx);
  const st = { aiming: false, scope: 0, zoom: 0, deadT: 0, sayAt: -99 };
  const health = createFootHealth(game, walker, (cause) => {
    loot.add(walker.pos, load.drop());
    Object.assign(st, { deadT: FOOT.respawnTime, aiming: false, scope: 0 });
    cam.setAim(false);
    game.callout("KILLED", CAUSE[cause] || null, "#ff4a2a");
  });
  const say = (text) => { if (game.time - st.sayAt > 1.2) { st.sayAt = game.time; game.emit({ type: "minor", text }); } };

  function fire() {
    const s = load.stats();
    if (!s) return false;
    if (game.weaponsSafeAt(walker.pos.x, walker.pos.z)) { say("NO WEAPONS IN A SAFE ZONE"); return false; }
    const u = load.use();
    if (!u.ok) {
      if (u.why === "reload") load.reload();
      else if (u.why === "empty") say(s.max ? `NO ${s.name.toUpperCase()} LEFT` : "OUT OF AMMO");
      return false;
    }
    // Where the screen centre points, then the line from the weapon to it (through the scope they are the same).
    const { o, d } = cam.ray(), far = game.combat.ray(o, d, 900, game.player);
    const from = st.scope ? o : fx.v3(walker.pos.x, walker.pos.y + 1.45, walker.pos.z).addScaledVector(d, 0.6);
    const dir = far.t > 4 ? far.point.clone().sub(from).normalize() : d.clone();
    if (!st.aiming && s.hip) { dir.x += (Math.random() - 0.5) * s.hip * 2; dir.y += (Math.random() - 0.5) * s.hip * 2; dir.z += (Math.random() - 0.5) * s.hip * 2; dir.normalize(); }
    if (s.kind === "bullet") shots.bullet(from, dir, s);
    else if (s.kind === "rocket") shots.rocket(from, dir, s);
    else shots.lob(s.kind, from, dir, s);
    if (s.sound) game.audio.shot(s.sound, walker.pos, true);
    walker.heading = cam.yaw;
    return true;
  }

  // After the walker has moved. busy: a menu, the intro or the build view has the keys.
  function control(busy) {
    const act = !busy && health.canAct();
    if (act) for (const k in SLOT_KEYS) if (keys.pressed(k)) load.select(SLOT_KEYS[k]);
    const s = load.stats();
    st.aiming = act && !!s && keys.aim();
    const zoom = st.aiming && s.zoom ? s.zoom : null;
    if (zoom && keys.pressed("KeyQ")) st.zoom = 1 - st.zoom;
    st.scope = zoom ? st.zoom + 1 : 0;
    cam.setAim(st.aiming, zoom ? zoom[st.zoom] : 0);
    if (!act) return;
    if (st.aiming) walker.heading = cam.yaw;
    if (keys.pressed("KeyR")) { if (load.sel !== "c4") load.reload(); else if (!shots.detonate()) say("NO CHARGES OUT"); }
    if (keys.pressed("fire")) fire();
  }

  function step(dt, on) {
    stunStep(game, dt);
    shots.step(dt);
    load.placed = shots.charges.length;
    if (!on) { health.hp = Math.min(health.max, health.hp + FOOT.regen * dt); return; } // mends in the cab
    load.step(dt);
    health.step(dt);
    if (health.dead) { st.deadT -= dt; if (st.deadT <= 0) onDead(); return; }
    if (loot.collect(walker.pos, load)) { game.audio.pickup(); game.emit({ type: "minor", text: "KIT PICKED UP" }); }
  }

  function frame(dt, time, on) {
    fx.update(dt);
    loot.frame(time);
    if (!on) return;
    const J = mesh.joints, s = load.stats(), flat = health.dead || health.down > 0;
    mesh.root.rotation.x = flat ? -1.45 : 0;
    if (flat) mesh.root.position.y += 0.22;
    mesh.root.visible = !st.scope;
    fx.hold(J.elbowR, !flat && s ? s.id : null);
    if (!st.aiming || flat) return;
    J.armR.rotation.x = Math.PI / 2 - cam.pitch; J.elbowR.rotation.x = 0; // weapon up, along the line of sight
    if (s.slot === "long") { J.armL.rotation.x = 1.25 - cam.pitch; J.armL.rotation.z = 0.5; J.elbowL.rotation.x = 0.4; }
  }

  return {
    health, load, shots, loot, fire, control, step, frame,
    dead: () => health.dead,
    canAct: () => health.canAct(),
    // Climbing out: empty hands get the starter kit, a safe zone restocks, and the car just left cannot run you over.
    out(car, zone) {
      const got = load.kit(!!zone);
      health.leftCar(car);
      if (got) game.emit({ type: "minor", text: got === "starter" ? "KIT · RIFLE, PISTOL, 2 GRENADES, 1 C4" : "AMMO RESTOCKED" });
    },
    // Back in a car, or respawned: weapons down. After a death the car left behind goes home and health is full again.
    rest() {
      if (health.dead) { rides.reset(); health.reset(); }
      Object.assign(st, { aiming: false, scope: 0, deadT: 0 });
      cam.setAim(false);
      mesh.root.rotation.x = 0;
      fx.hold(mesh.joints.elbowR, null);
    },
    blast: (pos, radius) => health.blast(pos, radius),
    hurt: (dmg, cause) => health.hurt(dmg, cause),
    give: (id, tier) => load.give(id, tier),
    hud() {
      const s = load.stats();
      return {
        hp: Math.ceil(health.hp), max: health.max, down: health.down > 0, dead: health.dead, cause: health.dead ? CAUSE[health.cause] || null : null,
        respawnIn: health.dead ? Math.max(0, Math.ceil(st.deadT)) : 0, aiming: st.aiming, scope: st.scope, held: s ? s.label : null,
        placed: shots.charges.length, safe: game.weaponsSafeAt(walker.pos.x, walker.pos.z), hurt: game.time - health.harmAt < 0.3, ...load.hud(),
      };
    },
    state: (on) => ({ onFoot: on, health: Math.ceil(health.hp), ...load.state(), aiming: st.aiming, scope: st.scope, down: health.down > 0, dead: health.dead, charges: shots.charges.length, loot: loot.list(), shots: { ...shots.stats } }),
    dispose() { shots.clear(); loot.clear(); fx.dispose(); },
  };
}