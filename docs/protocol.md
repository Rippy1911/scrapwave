# Scrapwake real-time protocol, v1

The room server is a **relay plus keeper of light world state**. It never simulates physics.

- Every browser simulates its own car and streams its state.
- One elected **host** browser per shard simulates the AI cars (Drifters, Rattlers, convoys, the Warlord), turrets and world AI, and streams their states.
- The server relays states as 15 Hz snapshots and owns the rules that need no physics: the cycle clock, plots, base modules and their HP, stashes, banked scrap, loot crates, radio jobs, siphon timing, damage caps and the ladder.

Transport: one WebSocket on `/ws`, UTF-8 JSON text frames, one message per frame. Every message is an object with a string field `t`. Units are metres, seconds and milliseconds; y is up; the map is 1,200 x 1,200 m centred on the origin. Shared tables (plots, rig positions, module costs and HP, weapon caps, limits) are in `world-config.json`, also served at `GET /config`. The client should load the same file instead of copying numbers.

## Limits

| Limit | Value | When exceeded |
|---|---|---|
| Client message size | 8 KB | socket closed, code 1009 |
| Client message rate | 60/s, burst 120 (host: 120/s, burst 240) | excess dropped; 3 seconds in a row over the limit, or over 1,000 drops in one second, closes with 4008 |
| Hello deadline | 10 s after connect | closed, 4003 |
| Heartbeat | server sends `ping` every 5 s; silence for 15 s | closed, 4000 |
| Host silence | 5 s without any message from the host | host handed over |
| Humans per shard | 24 (`MAX_PLAYERS_PER_SHARD`) | the join goes to another shard |
| Reconnect grace | 60 s | after that the seat, plot and wallet are released |
| Damage per sender | 600 per second (token bucket, burst 600) | hit or module hit dropped |

Before any close other than 1000 the server sends `{t:"bye", code, reason}`, because a client that is still sending may never read the close frame.

Close codes: 1000 normal, 1003 binary frame, 1009 too big, 1012 server restart, 1013 client too slow (over 4 MB of unsent snapshots), 4000 heartbeat timeout, 4001 replaced by a newer connection with the same session, 4002 wrong protocol version, 4003 no hello, 4008 rate limit.

## Joining

```
client -> {t:"hello", v:1, name, vehicle, paint, sessionId, shard?}
server -> {t:"welcome", v:1, you, shard, hostId, cycle, players, world, wallet}
```

- `name`: control and format characters (including bidi overrides) are stripped, whitespace collapsed, cut to 20 characters. Empty becomes `Driver-1234`.
- `vehicle`: `jackal`, `brawler` or `mammoth` (default `jackal`). `paint`: `#?[A-Za-z0-9_-]{1,24}` (default `rust`).
- `sessionId`: 8 to 64 characters `[A-Za-z0-9_-]`, one per browser tab. It is the resume key: a hello with a session that still holds a seat (connected, or within the 60 s grace) gets the **same player id, plot, wallet and stats** back. If that session is still connected, the older socket is closed with 4001. Never show or log it.
- `shard`: optional. The server resumes there if the session is known, joins it if it has a free seat, and otherwise picks the **fullest shard with room** (or creates one). The welcome says which shard you got.
- `cycle`: `{n, startedAt, durationMs, stormMs, now, phase}`; `phase` is `run` or `storm`. Times are server epoch ms; use `now` to estimate the clock offset.
- `players`: connected humans `[{id, name, vehicle, paint}]`, including you.
- `world`: `{plots:[claimed plots], crates:[...], jobs:[...]}`. A plot is `{id, owner, ownerName, ai?, stash, dark, modules:[{id, module, x, z, rot, hp, maxHp}]}`.
- `wallet`: `{bank, banked, plot, stash}` (see Economy).

Others receive `{t:"join", player, resumed?}`. When a socket drops they receive `{t:"leave", id}`; if the seat later expires and the player owned a plot, `{t:"plotFree", plot}`. A client that sends `{t:"bye"}` before closing is removed at once (no grace).

## Host

The first human in a shard is the host. When the host leaves, or sends nothing for 5 s, the server picks the longest-connected remaining player that is not itself silent and broadcasts `{t:"host", hostId}` (`null` if nobody qualifies). Only the host may send `ai`, `spawnCrate`, `job`, events of kind `ai`/`turret`/`convoy`, host-only weapons (`turretMg`, `turretRocket`, `flameTrap`), and the `ai`/`src` fields described below. The same messages from anyone else are dropped. A new host should seed its AI from the last snapshot's `ai` list.

## States and snapshots

```
client -> {t:"s", seq, x,y,z, qx,qy,qz,qw, vx,vy,vz, steer, thr, turbo, aimYaw, aimPitch, hull, flags, parts?}
host   -> {t:"ai", list:[{id, kind, name?, vehicle?, paint?, ...same fields}], remove?:[id]}
server -> {t:"snap", now, players:{<id>: state}, ai:[state]}
```

- Clients send their own state at up to 20 Hz; the host sends AI at up to 15 Hz. Only listed numeric fields are kept (x, y, z are required); positions are clamped to the map plus 200 m. `parts` may be an array of up to 64 short strings or numbers (detached parts) or an object of up to 64 numeric or boolean values (part HP). Other fields are dropped.
- AI ids are up to 24 characters `[A-Za-z0-9_.:-]` and must not collide with player ids (players are `u` plus 8 hex digits; prefix AI ids with `a`). The host may split the list across several `ai` messages (the server merges by id). An AI entry not refreshed for 2 s expires; `remove` deletes at once. At most 64 entries per message, 256 per shard.
- The server sends every client a snapshot at 15 Hz with every other connected player's latest state (never your own) and every live AI state. v1 has no interest management (everything goes to everyone) and no quantisation; the server is shaped so a radius filter can be added in `Shard.visible()`.

## Events

```
client -> {t:"ev", kind, ...}
server -> {t:"ev", from, kind, ...}   (to everyone in the shard except the sender)
```

The server rebuilds each relayed event from whitelisted fields, so unknown fields never reach other clients.

| kind | Fields | Rules |
|---|---|---|
| `hit` | `target, dmg, weapon, zone?, part?, px?,py?,pz?, src?` | `weapon` must be in `world-config.json` weapons; `0 < dmg <= maxHit` for that weapon; the target must be a connected player or a live AI; no self-hits; the attacker's 600/s damage budget must cover `dmg`. `src` (host only) names the AI or turret that fired; the budget is then per `src`. Aggregate fast weapons (send MG hits every 100 to 300 ms, not per bullet). The target's own browser applies the damage when it receives the relay; the host applies hits on AI. |
| `partOff` | `vehicle, part, impulse?:[x,y,z], by?` | sent by the vehicle's own simulator (the player, or the host for AI). |
| `wreck` | `vehicle, by?, x?,y?,z?` | same ownership rule; duplicates within 3 s are dropped; credits a wreck to `by` (ladder). |
| `explode` | `x,y,z, r, src?` | `0 < r <= 30`. |
| `loot` | `crateId, ai?` | first claim wins; the claimer must be within 25 m of the crate (by its last state). Reply `{t:"lootOk", crateId, scrap, part?}` or `{t:"lootNo", crateId, reason}` (`gone`, `far`, `nopos`); others get `{t:"ev", kind:"loot", crateId, by}`. |
| `bank` | `scrap, at?` | integer 1 to 5,000. `at:"town"` (default) needs you within 80 m of the Well-town; `at:"<plotId>"` needs your own lit plot and you within 20 m of its rig. Reply `wallet`; others get the event. |
| `chat` | `text` | sanitised, max 120 characters, 1 per second (burst 5). Relayed with `name`. |
| `emote` | `id` | integer 0 to 63 or a short id string. |
| `air` | `secs` | `0 < secs <= 15`; feeds best air (results, ladder). |
| `ai`, `turret`, `convoy` | free-form | host only; relayed as sent (within the 8 KB limit). |

## World actions (authoritative)

These go out as their own message types. Rejections come back to the sender only as `{t:"no", what, reason, ...}`. The host may act for an AI by adding `ai:"<aiId>"` (and `name`) to `claim`, `build`, `siphon`, `loot` and `bank`; the AI then owns the plot and its own wallet.

| Client sends | Server broadcasts | Rejections (`reason`) |
|---|---|---|
| `{t:"claim", plot}` | `{t:"claim", plot, by, name, ai?, rig}` | `plot` unknown, `taken`, `onePlot` (one plot per player per cycle) |
| `{t:"build", plot, module, x, z, rot}` | `{t:"build", plot, by, mod:{id, module, x, z, rot, hp, maxHp}}` plus `wallet` to the builder | `owner`, `dark`, `module` unknown (the rig cannot be built), `full` (40 modules besides the rig), `pos` (x, z are plot-local metres within plus or minus 30), `scrap` (`need`, `have`) |
| `{t:"modHit", plot, modId, dmg, src?}` | `{t:"modHit", plot, modId, hp, dmg, by}`; at 0 HP `{t:"modDead", plot, modId, module, by}` | silent drop: no such module, `dmg` over 400, damage budget |
| `{t:"siphon", plot}` | `{t:"siphon", plot, by, amount, stash}` plus `wallet` to the owner | `plot` unclaimed, `own`, `far`, `time` (`heldMs`) |
| `{t:"spawnCrate", id, x,y,z, scrap, part?}` (host) | `{t:"spawnCrate", id, x,y,z, scrap, part?}`; past 300 crates the oldest goes with `{t:"crateGone", id}` | silent drop: not host, duplicate id |
| `{t:"job", id?, done?, ...}` (host) | `{t:"job", ...}` | silent drop: not host. The last 8 jobs are kept for late joiners; `done:true` removes one by id. |

Rules in detail:

- **Claiming** creates the rig (3,000 HP, plot-local 0,0) at the plot's `rigX/rigZ`. The server does not check that you are at the beacon; the client enforces the 5 s hold.
- **Economy.** `bank` is scrap banked in town this cycle; each plot has a `stash`. A build is paid from `bank` first, then from your plot's stash. `banked` is the total banked this cycle (results and ladder). A refinery adds 4 scrap per second to its plot's stash while the rig stands; stash changes go out as `{t:"stash", plots:{id: amount}}` at most every 5 s. Everything resets when the cycle ends.
- **Siphon.** Accepted only if the server has received the sender's states (the host's AI states for `ai`) inside 15 m of that plot's rig continuously for 8 s, with no gap over 1 s, the latest within the last second. Takes 25% of the stash (the siphoner carries it; banking it is the client's job). The hold then restarts.
- **Rig destroyed.** The plot goes dark (no banking or building) and 40% of its stash spills as four crates around the rig (`spawnCrate` with ids `spill-...`).
- Modules can be hit by anyone, including their owner; HP and destruction are server-side.

## Cycle

Per shard: `CYCLE_MS` (30 min) of play, then `STORM_MS` (5 min) of storm, then results and a new cycle. The clock starts when the shard is created.

```
server -> {t:"cycle", phase:"storm", cycle}
server -> {t:"cycleEnd", n, results:[{id, name, banked, wrecks, bestAir, partsOff, siphons, ai?}], cycle, world}
```

Results are sorted by scrap banked. `cycle` and `world` describe the new cycle (no plots, crates or jobs).

## Wallet

`{t:"wallet", bank, banked, plot, stash, ai?}` arrives after your own bank, build, a siphon of your plot, and in the welcome.

## Heartbeat and latency

The server sends `{t:"ping", ts}` every 5 s; reply `{t:"pong", ts}`. A client may send `{t:"ping", ts}` at any time; the server answers `{t:"pong", ts, now}`. `rtClient.js` pings every 2 s and keeps a smoothed RTT.

## Ladder

Per cycle in memory (the results); per ISO week in `LADDER_FILE` (`./data/ladder.json`): best scrap banked in one cycle, total wrecks, best air, keyed by session id. Written at most every 30 s and on shutdown; when the week changes the old file is kept as `ladder-<week>.json`. `GET /ladder` returns the top 50 by name only.

## HTTP

| Path | Returns |
|---|---|
| `GET /health` | `{ok, shards, players, uptime}` (503 while shutting down) |
| `GET /shards` | `[{id, players (humans plus live AI), humanCount, maxHumans, hostId, cycle, phase, cycleTimeLeft}]` |
| `GET /stats` | snapshot loop timing (`tick.avgMs`, `p95Ms`, `maxMs` over the last 20 s), message counters, rejections, kicks |
| `GET /ladder` | `{week, top:[{name, bestScrap, wrecks, bestAir}]}` |
| `GET /config` | `world-config.json` |

All GET endpoints send `Access-Control-Allow-Origin: *`. `/ws` checks `Origin` against `ALLOWED_ORIGINS` when that is set.

## Browser module: `rtClient.js`

Plain ES module, no dependencies. Both factories return the same object, a superset of the game's `OfflineNet` seam, so `src/game/net/net.js` can pick one at start-up.

```js
import { createOnlineNet, createLoopbackNet } from "./rtClient.js";

const net = online
  ? createOnlineNet({ url: "wss://<host>/ws", name, vehicle: "brawler", paint: "#d9822b" })
  : createLoopbackNet({ name, vehicle, paint });

const welcome = await net.connect();       // resolves with the first welcome
net.onSnapshot((snap) => remoteCars.apply(snap));   // {now, players, ai}
net.onEvent((ev) => fx.handle(ev));                  // {from, kind, ...}
net.onHost((hostId) => ai.setEnabled(net.isHost()));
net.onWorld((m) => world.handle(m));                 // everything else, by m.t
net.onClose(({ code, reconnecting }) => hud.netStatus(code, reconnecting));

// every frame (both are throttled inside):
net.sendState(player.vehicle.netState());           // 20 Hz
if (net.isHost()) net.sendAi(ai.netStates());       // 15 Hz, split under 8 KB
net.sendEvent("hit", { target, dmg, weapon: "mg", zone: "front" });
net.sendEvent("claim", { plot: "p3" });             // world actions use the same call
```

| Method | Notes |
|---|---|
| `connect()` | Promise of the welcome. Rejects after five failed tries, or on 4001/4002. |
| `isHost()`, `myId()`, `shard()`, `rtt()` | `rtt()` is a smoothed ping round trip in ms (0 before the first pong). |
| `sendState(state)` | throttled to 20 Hz, latest wins; adds `t` and `seq`. Returns false while disconnected. |
| `sendAi(list)` | host only; throttled to 15 Hz; split into `ai` messages under 7 KB / 64 items. |
| `sendEvent(kind, data)` | `claim`, `build`, `modHit`, `siphon`, `spawnCrate`, `job` go out as `{t:kind,...}`; every other kind as `{t:"ev", kind, ...}`. Returns false while disconnected (nothing is queued). |
| `onSnapshot`, `onEvent`, `onHost`, `onWorld`, `onClose` | each returns an unsubscribe function. `onWorld` receives every message that is not a snapshot, event, ping or host change: `join`, `leave`, `claim`, `build`, `modHit`, `modDead`, `siphon`, `stash`, `wallet`, `spawnCrate`, `crateGone`, `plotFree`, `job`, `cycle`, `cycleEnd`, `lootOk`, `lootNo`, `no`, `bye`, and a **`welcome` after every reconnect** (resync your world from it). |
| `close()` | sends `bye` (no grace on the server) and stops reconnecting; `onClose` gets `{reconnecting:false}`. |

Reconnect: on an unexpected close the module retries after 1, 2, 4, 8 and 8 s (plus or minus 20% jitter), five tries, then gives up. Each retry sends the same `sessionId` and shard, so within the 60 s grace the player keeps id, plot and wallet. `onClose` fires on every drop with `reconnecting` true or false. The session id comes from `sessionStorage` (one per tab, kept across reloads); pass `sessionId` to override. `WebSocketImpl` can inject a WebSocket class (tests).

`createLoopbackNet()` needs no server: `connect()` resolves at once with a local welcome (`you:"local"`, host), `isHost()` is always true, states and AI go nowhere, events are not echoed (nobody else is there), and world actions are answered asynchronously through `onWorld` (`claim` keeps the one-plot rule, `spawnCrate` then `loot` gives `lootOk` then `lootNo`) without cost checks, because the offline game keeps its own economy.
