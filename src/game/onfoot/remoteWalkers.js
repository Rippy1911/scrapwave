// Other players on foot, online. Round 11: the pose rides in each player's car state (onfoot/footNet.js), and
// net/remote.js calls apply(id, { x, y, z, h, s, run, air }) / apply(id, { gone: 1 }) from the snapshots.
// The "foot" event path below stays as an alternative for when the server whitelists `foot` (FOOT_NET.send).
// Test without a server: window.scrapwake.onfoot.remote("p2", { x, y, z, h }) puts a walker in the world.
import * as THREE from "three";
import { net } from "@/game/net/net";
import { buildScavenger } from "@/game/onfoot/scavengerMesh";
import { newAnimState, animateScavenger } from "@/game/onfoot/scavengerAnim";

import { rayWalker } from "@/game/onfoot/walkerHit";

export const FOOT_NET = { kind: "foot", send: false, hz: 6, stale: 3 };
const WALKER_HP = 100, DEAD_TIME = 4;
const COATS = ["#5e6b3a", "#3f5f6e", "#7a4a3a", "#55504a", "#8c6a3b"];

export function createRemoteWalkers(game) {
  const walkers = new Map();
  let off = null, sendT = 0, wasOn = false;

  // Shots (onfoot/footShots.js): the first walker a ray meets, and what a hit does. Two body hits or one head hit
  // from the sniper kill. A dead walker lies where it fell for a few seconds; the room server has no event for it
  // yet, so the other player only dies on this screen.
  function ray(o, d, maxT) {
    let best = null;
    for (const [id, w] of walkers) {
      if (w.dead) continue;
      const h = rayWalker(o, d, best ? best.t : maxT, w.pos.x, w.pos.y, w.pos.z);
      if (h) best = { id, t: h.t, part: h.part };
    }
    return best;
  }
  function hit(id, part, dmg) {
    const w = walkers.get(id);
    if (!w || w.dead) return { hp: 0, dead: true };
    w.hp -= dmg;
    if (w.hp <= 0) { w.hp = 0; w.dead = true; w.goneAt = game.time + DEAD_TIME; w.mesh.root.rotation.x = -1.45; w.mesh.root.position.y += 0.2; }
    return { hp: w.hp, dead: w.dead };
  }

  function apply(id, d) {
    let w = walkers.get(id);
    if (d.gone) { if (w) { w.mesh.dispose(); walkers.delete(id); } return; }
    if (w && w.dead) return;
    if (!w) {
      const mesh = buildScavenger({ coat: COATS[walkers.size % COATS.length] });
      game.scene.add(mesh.root);
      w = { mesh, anim: newAnimState(), pos: new THREE.Vector3(d.x, d.y, d.z), to: new THREE.Vector3(), h: d.h || 0, speed: 0, run: false, air: false, t: 0, hp: WALKER_HP, dead: false, goneAt: 0 };
      walkers.set(id, w);
    }
    w.to.set(+d.x || 0, +d.y || 0, +d.z || 0); w.h = +d.h || 0; w.speed = +d.s || 0; w.run = !!d.run; w.air = !!d.air; w.t = game.time;
  }

  function listen() {
    const online = net.mode === "online";
    if (online && !off) off = net.impl().onEvent((ev) => { if (ev.kind === FOOT_NET.kind && ev.from) apply(ev.from, ev); });
    if (!online && off) { off(); off = null; for (const id of [...walkers.keys()]) apply(id, { gone: 1 }); }
  }

  return {
    apply, ray, hit,
    count: () => walkers.size,
    get: (id) => { const w = walkers.get(String(id)); return w ? { hp: w.hp, dead: w.dead, x: w.pos.x, y: w.pos.y, z: w.pos.z } : null; },
    // Our own pose out to the shard (when the server relays it).
    send(dt, me) {
      if (!FOOT_NET.send || net.mode !== "online") return;
      if (!me) { if (wasOn) net.impl().sendEvent(FOOT_NET.kind, { gone: 1 }); wasOn = false; return; }
      sendT -= dt;
      if (sendT > 0) return;
      sendT = 1 / FOOT_NET.hz; wasOn = true;
      const r = (n) => Math.round(n * 100) / 100;
      net.impl().sendEvent(FOOT_NET.kind, { x: r(me.pos.x), y: r(me.pos.y), z: r(me.pos.z), h: r(me.heading), s: r(me.speed), run: me.running ? 1 : 0, air: me.grounded ? 0 : 1 });
    },
    frame(dt) {
      listen();
      for (const [id, w] of walkers) {
        if (w.dead) { if (game.time > w.goneAt) apply(id, { gone: 1 }); continue; }
        if (game.time - w.t > FOOT_NET.stale) { apply(id, { gone: 1 }); continue; }
        w.pos.lerp(w.to, 1 - Math.exp(-dt * 10));
        w.mesh.root.position.copy(w.pos);
        w.mesh.root.rotation.y = w.h;
        animateScavenger(w.mesh.joints, w.anim, { speed: w.speed, running: w.run, airborne: w.air }, dt);
      }
    },
    dispose() { if (off) off(); off = null; for (const id of [...walkers.keys()]) apply(id, { gone: 1 }); },
  };
}