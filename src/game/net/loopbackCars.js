// Fake remote cars for checking remote rendering, hits and name tags alone (offline only). Each car is a
// scripted client on its own createLoopbackNet: it drives a road back and forth, fires short bursts at
// the player when close, sends its state through its net, and a tiny in-page relay turns those states
// into 15 Hz snapshots for the real remote-car code. Our `hit` events land on the fake car's hull.
import * as THREE from "three";
import { createLoopbackNet } from "@/game/net/rtClient";
import { encodePaint } from "@/game/net/codec";
import { surfaceY } from "@/game/world/spawn";

const NAMES = ["Loop Ada", "Loop Bix", "Loop Cato", "Loop Dex", "Loop Eno", "Loop Fen", "Loop Gus", "Loop Hal"];
const CARS = ["jackal", "brawler", "mammoth"];
const PAINTS = ["#3d7fb8", "#7fb83d", "#b83d9a", "#d6c23a", "#3ab8a8", "#e0603a"];
const HULL = 300, q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, "YXZ");
const r2 = (x) => Math.round(x * 100) / 100;

function sampleAt(road, s) {
  const S = road.samples;
  let i = 0;
  while (i < S.length - 2 && S[i + 1].s < s) i++;
  const a = S[i], b = S[i + 1], k = Math.max(0, Math.min(1, (s - a.s) / Math.max(0.01, b.s - a.s)));
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: a.dx, dz: a.dz };
}

export function createLoopbackCars(game) {
  const cars = [];
  let snapT = 0, time = 0;

  function add(i) {
    const id = "u" + (0xf00d0000 + i).toString(16), name = NAMES[i % NAMES.length];
    const vehicle = CARS[i % CARS.length], paint = encodePaint(PAINTS[i % PAINTS.length]);
    const nt = createLoopbackNet({ name, vehicle, paint });
    nt.connect().then((w) => game.netSync.remotes.setInfo(id, { ...w.players[0], id }));
    const p = game.player.pos, n = game.world.roads.nearest(p.x, p.z, 10, false);
    const road = n.road || game.world.roads.roads[0], S = road.samples;
    const s0 = (n.road ? S[n.i].s : S[0].s) + (i % 2 ? -1 : 1) * (40 + 30 * i);
    const s = Math.max(S[0].s + 5, Math.min(S[S.length - 1].s - 5, s0));
    cars.push({ id, nt, road, s, dir: i % 2 ? 1 : -1, speed: 12 + (i % 3) * 4, hull: HULL, deadT: 0, state: null, i });
  }

  function drive(c, dt) {
    const S = c.road.samples, p = game.player.pos;
    if (c.hull > 0) {
      c.s += c.dir * c.speed * dt;
      if (c.s < S[0].s + 5 || c.s > S[S.length - 1].s - 5) c.dir = -c.dir;
    } else if ((c.deadT -= dt) <= 0) c.hull = HULL;
    const at = sampleAt(c.road, c.s), alive = c.hull > 0;
    const fx = at.dx * c.dir, fz = at.dz * c.dir, y = surfaceY(game.world, at.x, at.z) + 1;
    q.setFromEuler(eu.set(0, Math.atan2(-fx, -fz), 0));
    const dx = p.x - at.x, dy = p.y - y, dz = p.z - at.z, d = Math.hypot(dx, dz);
    const close = d < 60 && game.player.alive, fire = alive && close && time % 6 < 1;
    const v = alive ? c.speed : 0;
    c.state = {
      x: r2(at.x), y: r2(y), z: r2(at.z), qx: r2(q.x), qy: r2(q.y), qz: r2(q.z), qw: r2(q.w),
      vx: r2(fx * v), vy: 0, vz: r2(fz * v), steer: r2(Math.sin(time * 0.7 + c.i) * 0.2), thr: alive ? 1 : 0, turbo: 0,
      aimYaw: r2(close ? Math.atan2(dx, dz) : Math.atan2(fx, fz)), aimPitch: r2(close ? Math.atan2(dy, d) : 0),
      hull: Math.max(0, Math.round(c.hull)), flags: (alive ? 1 : 0) | (fire ? 2 : 0), parts: [],
    };
    c.nt.sendState(c.state);
  }

  return {
    count: () => cars.length,
    set(n) {
      while (cars.length > n) { const c = cars.pop(); c.nt.close(); game.netSync.remotes.remove(c.id); }
      while (cars.length < n) add(cars.length);
      return cars.length;
    },
    // A `hit` we sent at a fake car: apply it to the scripted hull; at 0 it wrecks and returns after 6 s.
    onSend(kind, data) {
      if (kind !== "hit") return;
      const c = cars.find((x) => x.id === data.target);
      if (!c || c.hull <= 0) return;
      c.hull -= data.dmg;
      if (c.hull <= 0) { c.hull = 0; c.deadT = 6; game.callout("WRECKED " + game.netSync.remotes.name(c.id).toUpperCase(), "loopback car", "#f2c230"); }
    },
    step(dt) {
      time += dt;
      for (const c of cars) drive(c, dt);
      snapT -= dt;
      if (snapT > 0 || !cars.length) return;
      snapT = 1 / 15;
      game.netSync.remotes.ingest({ now: performance.now(), players: Object.fromEntries(cars.map((c) => [c.id, c.state])) }, "local", true);
    },
  };
}