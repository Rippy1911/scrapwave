# Scrapwave — game notes

2026-11-10: renamed from Scrapwake to Scrapwave (display name only; ids unchanged)
The ids keep the old spelling on purpose: `window.scrapwake` and its hooks, every localStorage key (`scrapwake-save-v1` and the rest), the blueprint prefix `SWB1.`, the uploads workspace id, telemetry names, the room-server and lobby ids, file names and the package name. The name players see comes from `GAME_TITLE` in `src/game/data/tuning.js`.

## Playing
- **Hit the road · Online** joins the shared Saltreach on the room server (`wss://scrapwake-rt.nextsolutions.studio/ws`). First time asks for a driver name (stored in `localStorage["scrapwake.driverName"]`, change it on the title). If the server can't be reached within 6 s you drive solo.
- **Single player** runs the same game on the loopback net (you are the host).
- Controls: see the Controls panel. Online extras: **Enter** chat, **T** emote wheel (1-4), **Tab** scoreboard (humans first).
- Handling feel (`src/game/vehicles/feel.js`): steering reaches full lock in about 0.12 s; **S** plus a hard steer above 50 km/h lets the rear step out into a held drift (S alone stops straight; **Space** is the sharper handbrake slide); a turbo press kicks 1.5x for its first half second.
- In the air: **W / S** pitch, **A / D** roll (a full flip in about 1 s), **Q / E** spin, **Space** levels out, turbo thrusts hard along the nose. The arrow keys drive on the ground but never turn the car in the air. A key held through take-off only counts after it is released and pressed again, so holding W off a ramp never noses the car down.
- Time always runs at 1x: no slow motion on big air, wrecks or explosions, no hit-stop, and instant replays and the demo reel play at 1x without letterbox bars.
- Base extras: stop at a plot beacon for 5 s to claim it, **B** on your plot opens the build view (**R** rotate, **Esc** leave), **L** accepts the radio job on offer.
- Round 8 keys: **LMB / J** guns, **F / K** rockets (K fires the harpoon on a car without rockets), **E** harpoon, **Tab** tap = next target / hold = scoreboard, **G** drop trap, **H** cycle trap, **U** buy the next trap tier at an outpost, **N** horn. Pad: D-pad down drop, left cycle, right next target.

## Aim (src/game/weapons: aimAssist.js, targets.js, playerAim.js, lockView.js, lockTone.js)
- **Assisted** (default): locks the target nearest the crosshair inside a 25° × 15° cone (kept until it leaves a 1.3x wider cone), only with a clear line. Targets: cars, enemy turrets and base modules, arena horde figures, barrels. Guns point at the lock; slow unguided rounds (autocannon, harpoon) get half the lead they need; rockets home only after 0.6 s on target (rising double beep). Out of range the marker is grey (shown to 1.5x range).
- Marker (`ui/LockMarker.jsx`, moved every render frame): brackets, hull bar, name and distance, the rocket ring closing in, a dim dashed box on the next target.
- **Manual**: the old free crosshair with a tiny snap (`game/player.js updateAim`). Pause menu → **Aim**; saved as `save.aimMode`.

## Traps (src/game/traps)
- One rear slot per car (`charges.js`): oil slick, spike strip, mine. **G** drops the selected one, **H** cycles. Outposts (Well-town, beside fuel stations) fix tyres and restock; arena repair crates do both too.
- Oil (`traps.js`, `grip.js`): most grip gone for about a second plus a spin kick. Fire (flamer, burning car) or any blast lights it for 6 s; cars crossing burn. Eight permanent oil spots on roads and by fuel stations (`oilSpots.js`) burn off and come back after 40 s.
- Spikes: pop tyres — less grip and top speed (Welded/War-forged also slow the car) until repaired.
- Tiers (`tiers.js`, `shop.js`): Scrap from the start; Welded (900 banked) after 15 jobs + contracts; War-forged (2200) after 40. Bigger slicks, meaner spikes, harder mines, +1 charge each. Custom games cap it with **Max trap tier** (`rules.maxTier`). AI tier follows skill (rookie 1, veteran 2, ace 3).
- AI (`aiTraps.js`): drops oil/spikes/mines on a hostile chasing close behind, and steers around traps it can see.

## Arena opponents (src/game/arena/opponents.js)
- Each opponent runs `think()` as it spawns, so `drive()` always has a target or a roam point (fixes "Cannot read properties of null (reading 'x')" on arena presets); `drive()` holds fire and waits if it has neither.
- Gunnery as in the open world: skill rolled like a Rattler (55 % rookie, 36 % veteran, 9 % ace), shifted by the rules' AI skill like `ruleSys` does, the same think rate (`AI.thinkHz`), spread (`spreadMul`) and per-target reaction delay from `ai/aim.js`.

## Bases (src/game/base)
- **Claiming**: each plot has a beacon pole and a striped 60 m ring. Stop inside it for 5 s and your flag unfurls; the Rig (the base core) is built with a floating stash counter. One plot per driver. Drifters claim and build plots of their own (`aiBases.js`).
- **Build view** (`buildView.js`): top-down camera over your plot, 2 m grid snap, a ghost outline (green valid, red blocked), **R** rotates, click places. "Stamp blueprint" re-places the last saved layout. Cost comes from banked scrap first, then the stash.
- **Modules** (`modules.js`, `models.js`; ids `scrapwall`, `platewall`, `spikewall`, `gate`, `mgturret`, `rocketturret`, `flametrap`, `garagepad`, `refinery`, `radar`): Rig, walls, spike wall, gate (opens for its owner), MG turret and rocket turret (`turrets.js`, real shots with lead aim), flame trap, garage pad (repairs), refinery (fills the stash over time) and radar mast (early raid alarm). Modules rise out of the ground, are real colliders, show damage and collapse into debris. A base with a dead Rig goes dark.
- **Raids** (`raids.js`): Rattler waves hit every lit base; Drifters raid bases they can beat. The owner gets a siren, a red arrow home (BaseAlert) and a radio line.
- **Siphoning**: a raider parked next to the Rig drains the stash; the siphon ring is visible to everyone. Wrecking a raider drops the siphoned scrap back as loot crates.
- Online, every base action is a request to the shared server (`netWorld.js`); offline the same code runs against a local stand-in.

## Cycle and storm (src/game/base/cycle.js, src/game/fx/storm.js)
- A cycle lasts 30 min (15 min with **Short cycles** in the pause menu, applied from the next cycle). Radio warnings at 5 min and 1 min.
- At the end the dust storm closes on the Well-town; outside it drains hull. Then stashes pay out to banked scrap, bases dissolve, the Results screen shows the cycle, and a new crash site is rolled.
- Online, the server owns the clock.

## Jobs, contracts, convoy, Warlord
- **Jobs** (`jobs.js`): five radio jobs (`crash`, `dump`, `tower`, `hunt`, `escort`); **J** accepts the one on offer (JobCard).
- **Contracts** (`contracts.js`): daily contracts in the garage, one reroll per day.
- **Convoy** (`ai/convoy.js`): the Cisterner water convoy runs from town to the dam. Rob it or guard it.
- **Warlord** (`ai/warlord.js`): a tractor-trailer with three trailer turrets. Rare, worth a lot.
- Online, the convoy and the Warlord are shared by everyone.

## Multiplayer model (src/game/net)
- `net.js` — wraps `rtClient.js`: loopback by default, `goOnline()` / `goOffline()`.
- `sync.js` — sends our car state (20 Hz) and, when host, the AI list (15 Hz); applies snapshots and events; host changes.
- `remote.js` — remote cars: interpolated ~120 ms behind server time, kinematic bodies, wheels/suspension/turrets/turbo/exhaust from motion, parts and wrecks from state.
- `damage.js` — each browser damages only the cars it owns; hits on remote cars become `hit` events (aggregated per 200 ms, split under the per-weapon caps in `world-config.json`). Shots/explosions of remote cars are cosmetic.
- `events.js` — hit, partOff, wreck, explode, chat, emote, bank, join/leave.
- `hostSwap.js` — non-hosts drop their local AI; a new host adopts the remote AI where it stands.
- `codec.js` — the hello `paint` field also carries the loadout (`c7762e_00r0mm11p`).

## Test hooks (window.scrapwake)
- `state()`, `teleport(place)`, `spawn(kind, where)`, `explodeNearest()`, `give(n)`, `setAutopilot(on)`, `demo(on)`, `replay()`, `setFuel(n)`.
- **Base**:
  - `scrapwake.base.fund(5000)` adds banked scrap.
  - `scrapwake.base.claim("p3")` claims a plot without the 5 s hold (ids in `base.state().plots` / `data/places.js`).
  - `scrapwake.base.build("mgturret", 0, 8, 1)` builds on your plot (plot-local metres, rot in quarter turns); returns `"sent"` or the reason it was refused. `base.modules` lists the ids.
  - `base.openBuild()` / `base.closeBuild()`, `base.stamp()`.
  - `base.raidNow()` sends a wave at every lit base; `base.damageRig(500)`.
  - `base.job("hunt")`, `base.jobs()`, `base.convoy()`, `base.warlord()`.
  - `base.state()` → your plot (stash, modules, raiders, siphon), owned plots, wallet, alert, convoy, warlord, jobs.
- **Cycle**:
  - `scrapwake.cycle.skipTo(1800)` jumps to the storm; `skipTo(2100)` to the cycle end.
  - `cycle.state()` → time, phase, clock text; `cycle.next()` starts the next cycle.
  - `scrapwake.startCycle({ short: true })` restarts with a 15 min cycle.
- **Net**: `net.state()` (mode, id, host, shard, rtt, humans, remote cars), `net.chat(text)`, `net.emote(0-3)`.
  - `scrapwake.net.loopback(3)` adds 3 scripted fake remote cars (max 8, offline only) through `createLoopbackNet`; shoot them to check remote rendering, hits (their hull drops, they wreck and come back after 6 s) and name tags. `net.loopback(0)` removes them.
  - `scrapwake.net.seats()` → `{humans, target, seated, leaving}` for Drifter seat balancing.
- **Aim**: `aim.mode()`, `aim.setMode("manual")`, `aim.lock()` → `{ id, kind, distance, inRange, lockT }`, `aim.rocketReady()`, `aim.candidates()`.
- **Traps**: `traps.list()` (slicks, oil spots, strips, mines), `traps.slot()`, `traps.drop("oil")`, `traps.cycle()`, `traps.tier()`, `traps.setTier(3)`, `traps.setProgress(40)`, `traps.refill()`, `traps.flat()`, `traps.clear()`.
- **Gunnery**: `sentry({ x, z, skill })`, `shotStats(true)` (AI rounds at you and hits), `god(true)`, `aimOf(id)`; in an arena `arenaOpponents()` → name, skill, alive, reaction.
- **Explosions**: `scrapwake.explodeNearest()` wrecks the nearest car (car-wreck blast, scale 1.3); `base.warlord()` then wreck it for the biggest one.

## Explosions (src/game/fx/particles.js, blastParts.js)
One `particles.explosion(x, y, z, scale)` call builds the whole blast, with every piece scaled by size: autocannon 0.3, turret/module 0.6, rocket 0.7, mine 1, barrel 1.1, car wreck 1.3, dump job 1.6, Warlord 2.8 + 2.2 (cab and trailer).
- Fireball core: pooled additive spheres in HDR colour (hot white → orange → dark red) so the bloom catches them, plus additive flame licks.
- Light flash from the pooled point lights (`fx.flash`, called by the callers).
- 20–40 spark streaks (instanced, stretched along their velocity, gravity) at full quality.
- Debris chunks (instanced boxes) that tumble and bounce on the ground.
- A dust shock ring on the ground plus outward dust (only when the blast is near the ground).
- Smoke that starts lit orange and cools to grey-brown while it rises (slight buoyancy) and spreads.
- Counts scale with the quality preset's `particles` budget; everything is pooled (no geometry per blast). Burning cars and dark wreck smoke use the same fire/smoke colours.

## Online extras (round 6)
- **Seat balancing** (`ai/seats.js`): where the AI runs (the host), the Drifter target is `24 − humans`, clamped to 6–10. Checked once a second; over target, the Drifter farthest from you drives off to a map-edge road point and despawns there with no human within 150 m. Under target, a benched Drifter respawns at the edge.
- **Title-screen online panel** (`ui/OnlinePanel.jsx`): players online and shards from `GET /shards`, weekly ladder top 10 from `GET /ladder`, refreshed every 30 s while the title is open, hidden if the server doesn't answer. Shown on wide screens.
- **Quality picker** lists every key of `QUALITY` in order (Ultra appears when the graphics update adds it). Auto-detect picks the starting preset until you choose; your choice is saved (also re-detected if a saved preset no longer exists).

## AI ramp runs (ai/rampRun.js)
The approach point is found by walking the road samples backwards from the ramp (against its direction) to `len/2 + 16` m behind it, at road height; ramps with no road behind them are skipped. A car in ramp mode under 3 km/h for 2 s gives up, goes back to roaming and waits 20 s before trying another ramp.

## Round 6 check
- Build and lint clean. `/?test=1` and `/?autoplay=1` load and drive in the preview.
- Not run in a real browser here (no headless browser in the build sandbox): the 60 s demo reel, `explodeNearest()` blasts, `net.loopback(3)` and the console check. Do these by hand in the preview console.
- Two-tab test: open the app in two tabs, pick Online in both — each sees the other car, hits apply on the owner's side.

## Round 8 check
- Build clean (lint: no errors). Title screen with the demo reel behind it and `/?autoplay=1&debug=1` load and drive in the preview with the traps, assisted aim and new HUD wired in.
- Still to check by hand in the preview console (no headless browser in the sandbox): an arena preset start, `shotStats(true)` with a parked `god(true)` car for AI hit rates, a few `traps.drop()` of each kind, Tab cycling, the pause-menu Aim switch.

## Safe zones and on foot (src/game/onfoot, round 9)
- **Zones** (`zoneSources.js`, `zones.js`): the Well-town, every outpost (fuel stations away from town) and your own lit plot — the plot stops counting while raiders are heading for it, so turrets can defend it. Faint green ground rings (`zoneRings.js`). None in arenas.
- **Weapons gate** (`weaponsGate.js`, runs after every controller): nobody fires inside a zone (salvos cancelled); base turrets never shoot into one. Empty cars count as safe for all targeting.
- **On foot** (`onfoot.js`): stop (under 4 km/h) inside a zone and press **E** to climb out by the driver door (outside the zones: see "On foot outside the zones" below). **WASD** walk (camera-relative), **Shift** run, **Space** jump, mouse orbits the third-person camera (`footCam.js`, pulls in at walls). The ring stops you ("GET IN A VEHICLE TO LEAVE THE SAFE ZONE"). Your car stays parked, handbrake on. Arenas, the demo and the autopilot always drive.
- **E on foot** (`interact.js`, `landmarkUse.js`): get into your car, a summoned one or any **FREE** car; at the Trader (town stand and every outpost) buy the next trap tier or restock / patch tyres; at the Garage open the Garage screen; at the Job Board take a job.
- **Free cars** (`freeVehicles.js`): Tier I buggies and brawlers with a floating FREE tag in town (3) and at every outpost (2). No upgrades, can't be modified. Taken spots refill after 180 s; an abandoned free car despawns after 90 s.
- **Choose your ride** (`spawnFlow.js`, `ui/SpawnMenu.jsx`): at session start and after every wreck. Spawn points are the zones you have visited (town always; saved in `save.rides.visited`). Pick a free car there or a garage car (loadout, armour, modules, trap tier, blueprint shown). A wrecked garage car is ready after 60 s or pay its repair (30 % of hull in banked scrap). Scripted modes, demo, autopilot and arenas respawn straight away as before.
- **Summon** (**Z** on foot in a zone): one of your garage cars rolls out of the garage door (outposts: beside the centre) and waits. One garage car out at a time; the previous one goes home.
- **Others on foot online** (`remoteWalkers.js`): ready, but the room server has no `foot` event kind yet, so `FOOT_NET.send` is off; you see their parked car.

## Arena targeting spread
- At most two arena opponents hunt the same car (`MAX_HUNTERS` in `arena/opponents.js`); the rest pick another car, the horde or roam. `arenaOpponents()` now lists each one's `target`.

## Bulwark tank family (2026-11-11)
- Chassis `bulwark` (`class: "tank"`): skid-steer tracks (10 raycast wheels), hull cannon + coax MG, directional armour, garage tiers (engine, tyres, turbo, tank, traverse, cannon, armour). Arena horde and base raids can spawn an **Iron Maw** boss.
- Test: `?tankcheck=1` (same hooks pattern as `?bikecheck=1`).

## Round 9 check
- Build clean, lint clean. `/?selfcheck=1` loads and drives with zero self-check errors, the zones, gate and free cars running (29 vehicles with free cars).
- Test hooks: `scrapwake.onfoot.state() / exit() / enter(id) / zones() / landmarks() / free() / parked() / summon() / teleport(x, z) / remote(id, {x,y,z,h})`, `scrapwake.spawnMenu.open() / options(zone) / choose(zone, "free" | chassis, { repair }) / close()`.
- Still to check by hand in the preview (no headless browser in the sandbox): Single player → Choose your ride → drive into town, stop, E out, walk to the ring, E into a FREE car, Z summon.

## Race worlds (src/game/maps/race, src/game/race) — round 15
- Four worlds: Foundry Pen, Glowfield, Brokeway, Ridgeback Pass (`maps/worlds.js`). Each loads as its own map with a spline track (`race/track.js`), barriers, kerbs, checkpoint gates, a lap clock and AI on the race line; Wreck Race runs on them through `maps/race/trackRace.js`.
- City blocks are 160 m chunks (`maps/race/chunks.js`): detailed instanced walls within 250 m, one cheap instanced mesh per chunk out to 1100 m.
- Checkpoint gates (`race/trackGates.js`) are two instanced meshes (posts, unlit lamps) plus two lit lamps that move to the next gate.
- Check: `?racecheck=1` shows the track table; add `&track=foundry|glowfield|brokeway|ridgeback` for a one-lap race there, `&debug=1` for draw calls and `&quality=<preset>` for this visit only.
- Measured at the start line, High, 1280×720, 6 cars + 7 others: Foundry Pen 593 draw calls / 446k tris (638 before the gates were instanced), Glowfield 530 / 456k, Brokeway 580 / 481k, Ridgeback 547 / 482k (the last three before the gate change). Free roam at Well-town: 847 / 2304k. All four are over the 400 budget; the 13 vehicles are the next thing to count.

## The Ashmark Expanse (src/game/maps/ashmark) — round 15
- A 10 × 10 km free-roam map with five biomes (ruined city, the Spine, dunes, marsh, waste flats), streamed in tiles at three detail levels (`streamer.js`); colliders only under the cars. `bigWorld.js` swaps it in for the Saltreach, which stays loaded and hidden.
- Play → free roam → **The Ashmark Expanse** (solo or online entry). The picker calls `wantRoam(id)`; the big world takes it at session start.
- Off while in the Ashmark: the cycle and storm, the rule-driven AI population, Choose your ride, free-roam position saving. The edge pushes ground cars back (`edge.js`); aircraft are clamped to `game.big.bounds`.
- Hooks: `scrapwake.big.state() / enter() / leave() / teleport("city" | "spine" | "dunes" | "marsh" | "waste" | {x, z}) / spots() / height(x, z) / resetMax() / check()`.
- Roads and places: 25 roads (48.9 km: the Ring highway, the connecting roads and the tracks) laid by `roads.js` from `roadNet.js` and graded into the ground (`grading.js`), bridges as level decks; 25 places from `sites.js`, built by `build/*.js` and streamed in within 1.5 km (`sitesLive.js`).
- Dressing (`dressing.js`, one round-15 part): the ground scatter (`scatter.js`: rocks, slabs, snags, posts, rib cages; drive-through, no colliders), the outposts (`outposts.js`) and the biome look (`look.js`).
- Outposts: the four garages and The Last Toll are safe zones, added to the game's own zone and landmark lists while the Ashmark is active (ground rings, no guns, E out of the car). A garage has one trader stall and a garage bay, and mends a car that stops in its ring (under 8 km/h) by 5 % of its hull per second. The toll has two trader stalls and no repair. Their traders use the Well's goods and reputation (`factions/trader.js` falls back to `well`). Not wired there: free cars and spawn points.
- Biome look: weather only. Flats and Spine clear, Old Varrow fog, the Sallow Sea dust, the Drownings rain. It fades in after the camera has been 3 s in a biome; a match whose rules set a weather keeps it; leaving puts back the weather rule from before.
- More hooks: `big.places() / roads() / sites() / life()`; `big.teleport` also takes a place id (`"g-city"`, `"toll"`, ...).
- Check: `?bigcheck=1` enters the map, visits the five biome spots (at least 4 s each, so the biome's weather has arrived) and then the four garages and the toll, waits for the streamer to settle plus 2 s at each, and shows two tables (BigCheckCard and `ui/CheckTable.jsx`, also `console.table`). Spots: tiles, colliders, build ms, draw calls, frame ms, heap, roads, places, scatter, weather. Outposts: the safe ring under the car, guns off inside and on 6 m outside it, traders, garage bay, and how far a garage mended a car that arrived at half hull. A failed cell reads NO in red.
- Headless run 2026-11-11 (Node, not a browser: the game's own map, road, collider, place, outpost, ring and weather code against a real Rapier world; no rendering and no car physics, so no fps or draw calls). Start: map 0, 0, ground 9.0 m and collider 9.0 m, released after 15 frames, 40 m short of the start of the flats road and facing it. Carried 2.4 km down the flats road at 216 km/h: a collider under the car at all 200 samples, road against collider 0.05 m at worst, 0 rescues. All five outposts: built, car 6 m inside the ring, guns off inside and on outside, landmarks inside the ring, garages mend 80 to 180 of 200 hull in 10 s, the toll 0. One ring per zone, 0.14 m above its ground, not redrawn over 120 frames; leaving removes the zones, landmarks and rings and restores the weather. Check rows: tiles 13/19/56, 10/27/49, 13/19/56, 9/28/54, 9/29/52 by detail, scatter 502 / 768 / 656 / 227 / 729, 2 to 5 places live, place build 4.3 ms at most, tile build 5.5 to 10.5 ms at most over three runs (over the 6 ms budget at four of five spots, Node timing). The whole check takes 35 s of game time.
- Still to see in a browser: all of the above on screen (materials, fps, draw calls), the trader and garage screens opening at the Ashmark stalls, and driving there with the real car physics.
- Measured 2026-11-11 in the builder preview (software renderer, 1280×720, so frame times are not real): waste flats on Low: tiles 9/7/28 by detail, 9 live colliders, settled in 1 s, tile build max 7.4 ms (budget 6), 100 draw calls, 236k tris, heap 391 MB, car 0.9 m above ground, 0 rescues. Waste on High: 166 draw calls, 416k tris. The second spot showed 779 draw calls on Low and one Drifter present. The other four rows did not finish inside the 30 s the preview capture allows.

## On foot outside the zones: danger and weapons (src/game/onfoot, round 15)
- **Get out anywhere** (`exitRules.js`): in free roam **E** climbs out with wheels on the ground and under 15 km/h; otherwise a line says why ("TOO FAST…", "CAN'T GET OUT IN THE AIR"). Inside a safe zone the old rule stands (under 4 km/h). A car with a working harpoon fires it on E, so it only lets you out when stopped. Arenas, races, the demo, the autopilot and aircraft stay vehicle-only.
- **Health** (`footHealth.js`, numbers in `footGear.js` `FOOT`): 100. A car touching the walker at 12 km/h or more kills, slower knocks down for 1.5 s; the car just left cannot run you over for 2 s. Landing faster than 11.5 m/s hurts, 22 m/s kills. Mends 3 per second after 8 s unharmed, and in the cab.
- **Explosions** (`weapons/combat.js` `explode` and `shielded`, `footHealth.js` `blast`): every blast that goes through `combat.explode` kills a walker whose chest (0.9 m up) is inside its radius, your own included: car rocket 5.6 m, mine 5, barrel 7, car wreck 8, Pipe grenade 6 / 7 / 8, C4 7 / 8 / 9, Stovepipe 5 / 6 / 7. A wall, building, base module or rock on the line from the blast to the chest covers the walker, down to 0.4 m from the body (a car needs 1 m), so standing against a wall works and a kerb covers nobody. Blasts replayed here for another player's car (no damage to cars on this browser) kill your walker too. Nothing happens to you in the cab. A safe-zone ring does not protect a walker from a blast. Not wired: the base rocket turret's blast (`base/turrets.js` has its own) and blasts that arrive only as a net `explode` event (other players' mines, grenades, barrels); other players on foot are not killed by a blast on this screen.
- **Death** (`footCombat.js`, `footLoot.js`): the kit drops as a bag (5 minutes, at most 4 out), "KILLED" with the cause, and 3 s later the usual respawn (Choose your ride). Walking over the bag takes it back: a higher tier replaces, the same gun adds its rounds, throwables add up to their limit.
- **Loadout** (`loadout.js`, `footGear.js` `GEAR`): key **1** long gun (Farcall rifle or Stovepipe launcher), **2** Rivet pistol, **3** up to 3 Pipe grenades, **4** up to 2 C4. All in Tier I, II, III (Scrap, Welded, War-forged). **LMB** fires or throws, **RMB** aims, **R** reloads (with C4 in the hands it blows the charges out), **Q** changes the scope's zoom step. Empty hands get the Tier I starter kit on climbing out; a safe zone restocks. No weapons inside a safe zone.
- **Shots** (`footShots.js`): bullets have travel time and drop (9.8 m/s²). Rifle 420 / 520 / 640 m/s, 5 rounds, 10 / 15 / 20 spare, 1.1 s between shots, 2.6 s reload, 8 / 12 / 16 hull damage. Walkers (`walkerHit.js`, `remoteWalkers.js`, 100 health): rifle body 50 / 60 / 70, head 200; pistol body 25 / 30 / 34, head 50 / 60 / 68.
- **Drivers** (`driverHit.js`): a hit through the glass (upper part of the hit box; from the ends it must be above the bonnet) costs the driver 50 / 70 / 100 of 100 and makes any AI driver duck (no controls for 3 / 4 / 5 s). A Rattler (not a base raider) whose driver dies leaves a FREE car anyone can take; other crews only duck.
- **Camera** (`footCam.js`): 62° at 4.3 m; aiming goes over the right shoulder (48°, 1.9 m, 0.55 m to the side, settles in 0.28 s); the scope looks from the eye at 20° / 9° (Tier I), 18° / 7.5°, 16° / 6°. The screen centre is the line of fire.
- **On screen** (`ui/foot/`): `FootHud.jsx` puts the walker's health and the four slots (magazine / spare, counts, charges out) where the hull panel sits while driving, plus `FootCrosshair.jsx` (screen centre, closes up when aiming), `ScopeOverlay.jsx`, `FootKeys.jsx` (left legend, off on touch), a red edge when hurt and the KILLED card.
- **Swapping your own cars** (`rides.js`): getting into a second car of your own parks the one you left; the one you are getting into is never cleared away.
- Hooks: `scrapwake.foot.state()` → `{ onFoot, health, slots, ammo, aiming, scope, down, dead, charges, loot, shots }`; `scrapwake.foot.give("sniper" | "rpg" | "sidearm" | "grenade" | "c4", tier)`. (`scrapwake.give(n)` is still scrap.)
- Check 2026-11-11 (Node, not a browser: the real on-foot modules bundled against a stub world, cars as plain boxes; no rendering, no input, no car physics). Build exit 0, lint 0 errors. Eight of eight pass: car swap (both cars still in the world after each swap); exit rule (out at 0, 10, 14.9 km/h; refused at 15 and 40, in the air, at 10 in a zone); danger (kill at 12, knock at 11.9 and 5, nothing at 1.4 or driving away; down 1.52 s; grace 2.02 s; landing at 11 / 14 / 16.75 / 20 / 22 m/s leaves 100 / 76 / 50 / 19 / dead; 70 → 73 one second after the 8 s wait); death (bag holds the whole kit, respawn asked once after 3.02 s, pickup gives spare 25 and 72, 3 grenades, 2 C4); tiers (5 items × 3 tiers all differ; `give` clamps tier 9 to III and refuses an unknown id); rifle (197.55 m: 0.48 s and 1.12 m drop at Tier I, 0.32 s and 0.49 m at Tier III; 2 body or 1 head shot kills); driver (side glass: hurt then dead at Tier I, dead in one at Tier III; door and bonnet hits never reach the driver); camera (numbers above; line of fire 0° off the screen centre).
- That check found and fixed: a shot from dead ahead never counted as through the glass. Fixed in the same round but not found by the check (none of the eight watches the hit marker): taking damage flashed the hit marker meant for hits you land.
- Explosion check 2026-11-11 (the same Node harness with the real `weapons/combat.js` and `world/colliders.js`; `vehicles/physics.js` and the two lines of `onfoot.js` that pass a blast on are stand-ins). Build exit 0, lint 0 errors, nine of nine pass. Car rocket, radius 5.6 m: dead at 5.5 m, untouched (100) at 5.7 m. Scrap wall (0.6 m thick) in between: alive 2 m behind it and standing against it. Kerb 0.3 m high, blast on the ground 5 m away: dead. In the cab 2 m from the blast: walker 100, car lost 54 hull. Another player's rocket at 3 m: walker dead, a local car 4 m away lost 0. Own Tier I grenade dropped by the feet: one blast, dead, one bag, respawn asked 3.02 s later; thrown, it burst 16.1 m away and did nothing. Own C4 by the feet, blown by hand: dead. A second blast on a dead walker: still one bag, respawn asked once after 3.02 s. Inside a safe zone at 2 m: dead.
- That check found and fixed, in the edit saved before it: a walker standing against a scrap wall died through it (cover only counted 1 m or more from the body), and a 0.3 m kerb covered a standing walker (the line ran to the feet).
- `?selfcheck=1` was not run for this change: it needs a browser, the sandbox has none, and the preview screenshot was ruled out for this task.
- Not seen in a browser yet: all of it on screen, with real input and real car physics.

## Fame, ranks and profile (src/game/fame) — 2026-11-11
- Six fame tracks (Carnage, Speed, Stunts, Survival, Salvage, Sky) with 10 ranks each; overall rank from total fame, topping out at **Post-Apocalyptic Overlord**. Full title table in `src/game/fame/titles.js`.
- Title → **Profile**: ranks, track bars, titles, emblem editor (shape, icon, two colours, border; `walker` slot reserved), optional 14-char tag, equipped title. Saves in `save.fame` / `save.profile`; signed-in drivers sync through `PlayerProfile` + `saveProfile` / `loadProfile`.
- Nametags (`nametag.js`): emblem, name, title/tag; online humans pack a compact emblem + title on the hello `paint` suffix (`codec.js`, within the 24-char cap).
- Hooks: `scrapwake.fame.view()`, `.check()`, `.report()`; `?famecheck=1` scripted check (also restores save after).

## Not yet networked
Traps are local to each browser (a slick dropped online is not seen by others yet). On-foot poses wait for a `foot` event kind on the room server.
Scrap pickups and banking stay local per browser (bank events feed the scoreboard).