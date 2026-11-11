// Glue between the game and the net: sends our state (and the host's AI), applies snapshots and events,
// routes hits, part-offs, wrecks and explosions of vehicles we own, and handles host changes and drops.
import { net } from "@/game/net/net";
import { packState } from "@/game/net/codec";
import { packMech } from "@/game/net/mechNet";
import { packRide } from "@/game/net/rideNet";
import { createRemotes } from "@/game/net/remote";
import { createHitQueue } from "@/game/net/damage";
import { createEventHandlers } from "@/game/net/events";
import { dropLocalAi, adoptAi } from "@/game/net/hostSwap";
import { showEmote } from "@/game/net/emotes";
import { createLoopbackCars } from "@/game/net/loopbackCars";
import { packFoot } from "@/game/onfoot/footNet";

export function createNetSync(game) {
  const remotes = createRemotes(game);
  let offs = [], state = "offline", wasHost = true, aiT = 0, shard = null, count = 1;
  const online = () => net.mode === "online" && state !== "offline";
  const myId = () => net.myId();
  const nid = (v) => (v === game.player ? myId() : v.netId || (v.netId = "a" + v.id));
  let fakes = null; // window.scrapwake.net.loopback(n) cars (offline only)
  const send = (kind, data) => { if (fakes) fakes.onSend(kind, data); return online() && net.impl().sendEvent(kind, data); };
  const hits = createHitQueue(game, (d) => send("hit", d), nid);

  // Vehicle with this id that this browser owns (our car, or the AI when hosting).
  const owned = (id) => (id === myId() ? game.player : game.vehicles.find((v) => !v.remote && v !== game.player && v.netId === id) || null);

  // Hooks on the existing game callbacks (installed once).
  const detach = game.fx.detach;
  game.fx.detach = (v, part, dir) => {
    detach(v, part, dir);
    if (!game.cosmetic && !v.remote) {
      const by = v.lastHitBy && game.time - v.lastCombat < 3 ? nid(v.lastHitBy) : undefined;
      send("partOff", { vehicle: nid(v), part: part.id, ...(by ? { by } : {}) });
    }
  };
  const onWreck = game.onWreck;
  game.onWreck = (v, attacker) => {
    if (!game.cosmetic && !v.remote) send("wreck", { vehicle: nid(v), ...(attacker ? { by: nid(attacker) } : {}), x: Math.round(v.pos.x), y: Math.round(v.pos.y), z: Math.round(v.pos.z) });
    onWreck(v, attacker);
  };
  const spawnRattler = game.ai.spawn;
  game.ai.spawn = () => (net.isHost() ? spawnRattler() : null);
  game.onBank = (scrap) => { for (let left = Math.round(scrap); left > 0; left -= 5000) send("bank", { scrap: Math.min(5000, left), at: "town" }); };
  game.onAirLanded = (secs) => { if (secs > 0) send("air", { secs: Math.min(15, Math.round(secs * 10) / 10) }); };

  const sync = {
    remotes, owned, myId, nid,
    peers(d) { count = Math.max(1, count + d); net.setPeers(count); },
    resumed(m) {
      state = "online"; shard = m.shard; count = m.players.length;
      for (const p of m.players) if (p.id !== m.you) remotes.setInfo(p.id, p);
      net.setPeers(count);
    },
    start(welcome) {
      if (fakes) { fakes.set(0); fakes = null; }
      sync.stop();
      if (!welcome || net.mode !== "online") return;
      const impl = net.impl(), h = createEventHandlers(game, sync);
      sync.resumed(welcome);
      offs = [
        impl.onSnapshot((m) => remotes.ingest(m, myId(), net.isHost())),
        impl.onEvent(h.onEvent),
        impl.onWorld(h.onWorld),
        impl.onHost(() => sync.hostChanged()),
        impl.onClose((c) => sync.closed(c)),
      ];
      wasHost = true;
      sync.hostChanged();
    },
    hostChanged() {
      const me = net.isHost();
      if (me && !wasHost) { adoptAi(game, remotes.takeAi()); game.emit({ type: "minor", text: "YOU NOW RUN THE AI" }); }
      else if (!me && wasHost) dropLocalAi(game);
      wasHost = me;
    },
    closed(c) {
      if (c.reconnecting) { state = "reconnecting"; return; }
      if (state === "offline") return;
      sync.stop();
      net.goOffline();
      if (!game.vehicles.some((v) => v.team === "rattler" || v.team === "drifter")) { game.ai.populate(); game.drifters.populate(); }
      game.callout("CONNECTION LOST", "driving solo", "#ff8a3a");
    },
    stop() {
      for (const off of offs) off();
      offs = [];
      remotes.clear();
      state = "offline";
    },
    queueHit: (v, amount, weapon, point, attacker) => hits.add(v, amount, weapon, point, attacker),
    sendExplode(pos, r, scale) { send("explode", { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10, z: Math.round(pos.z * 10) / 10, r: Math.min(30, Math.round(r)), scale: Math.round(scale * 100) / 100 }); },
    chat(text) {
      const t = String(text || "").trim().slice(0, 120);
      if (!t) return;
      send("chat", { text: t });
      game.emit({ type: "chat", name: "You", text: t, me: true });
    },
    emote(id) { send("emote", { id }); showEmote(game, game.player, id); },
    loopback(n) {
      if (online()) return "offline only";
      if (!fakes) fakes = createLoopbackCars(game);
      const c = fakes.set(Math.max(0, Math.min(8, n | 0)));
      if (!c) fakes = null;
      return c;
    },
    step(dt) {
      if (!online()) {
        if (fakes) { fakes.step(dt); remotes.step(dt); hits.step(dt); }
        return;
      }
      remotes.step(dt);
      hits.step(dt);
      const impl = net.impl();
      // on foot: the scavenger rides in the car's state; a moving machine adds its mode, fold and joints (net/mechNet.js)
      const st = packFoot(packState(game.player), game);
      impl.sendState(game.onfoot.active() ? st : packRide(packMech(st, game), game.player));
      aiT -= dt;
      if (net.isHost() && aiT <= 0) {
        aiT = 1 / 15;
        const list = [];
        for (const v of game.vehicles) if (!v.remote && v !== game.player && !v.arena && (v.team === "rattler" || v.team === "drifter" || v.team === "cisterner" || v.team === "warlord" || v.team === "militia")) list.push({ id: nid(v), kind: v.team, name: v.name, vehicle: v.chassisId, ...packState(v) });
        impl.sendAi(list);
      }
    },
    pill() {
      if (net.mode !== "online") return { state: "offline", label: "Single player" };
      if (state === "reconnecting") return { state, label: "Reconnecting..." };
      return { state: "online", label: `Online · ${shard || "?"} · ${count} driver${count === 1 ? "" : "s"} · ${Math.round(net.impl().rtt())} ms${net.isHost() ? " · host" : ""}` };
    },
    scoreRows: () => remotes.humans(),
    debug: () => ({ mode: net.mode, state, id: myId(), host: net.isHost(), shard, rtt: net.impl().rtt(), humans: remotes.humans(), remoteVehicles: game.vehicles.filter((v) => v.remote).map((v) => ({ id: v.netId, name: v.name, team: v.team, alive: v.alive, hull: Math.round(v.hull), x: Math.round(v.pos.x), z: Math.round(v.pos.z) })) }),
  };
  return sync;
}