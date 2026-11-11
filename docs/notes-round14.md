# Round 14 notes

## Done
- **Aim limits**: every gun, turret and fortress barrel stops at 35 degrees up and 20 down (`weapons/aimLimits.js`).
  The crosshair rises with the aim.
- **Turbo flight**: Off, Arcade (default) and High, set by the Flight rule (`vehicles/turboFlight.js`). Heavy cars
  sink slowly, light cars and bikes nearly hover, wings add lift and save turbo. A bigger turbo tank flies longer.
  The Workshop stats panel shows an Aero score.
- **Side mounts**: every car frame has a free small mount on each flank (`sl`, `sr`). They come last in the mount
  list, so older designs keep their weapons.
- **Loadout** (pause menu): each weapon mount can be moved to Guns (LMB / J), Heavy (F / K), Utility (E) or Off.
  Choices are saved by mount id in `save.binds` (`weapons/binds.js`).
- **Key legend**: left edge of the HUD on keyboards, built from the current bindings. Switch it off in Loadout.
  Never shown on touch.
- **Day, night and weather** (`world/sky/`): rules Time of day, Day cycle (off, slow, normal, fast), Weather
  (random, clear, dust, rain, fog, thunderstorm) and Wind. Hour 9 is the same light as before. Stars at night,
  rain streaks slanted by the wind, lightning with thunder in a storm. The sky's haze band always takes the fog
  colour, so the horizon matches the ground in every hour and weather.
- **Glowfield**: the last ring is now the start line, so cars on the grid no longer pass a ring at once.

- **Hosted asset pack** (`assets/cdnPack.js`): models and sounds are not in the repo. They sit on
  `uploads.nextsolutions.studio` and are fetched cross-site at runtime. The manifest is fetched once at boot;
  `model(key)` gives a template (scaled to the manifest's height, centred, feet on y = 0, facing +Z, clips keyed
  idle / walk / run / attack ...) and `cloneModel()` copies it (SkeletonUtils for skinned ones); `sound(key)` gives
  the raw bytes for `decodeAudioData`. When the server cannot be reached everything answers null and the game
  carries on with its built figures and synthesized sound.
- **Horde models** (`arena/hordeModels.js`): zombies are 55% `zombie`, 35% `zombie_b`, 10% `brute` (drawn 1.6 x);
  aliens are 80% `alien` (tinted grey, head bone 1.25 x) and 20% `alien_heavy` (1.3 x). Figures within 45 m of the
  camera are animated models (walk, run for aliens on the chase, attack while clawing); beyond 55 m, over the cap
  (10 on Low, 18 on Medium, 28 above) or before a model has loaded they are the built box-and-ball figures.
  Gameplay is unchanged: speed, damage and hit tests are the same for every variant.
- **Sampled sound** (`audio/samples.js`, `audio/engineLoops.js`): machine gun, scatter gun, autocannon, explosions,
  impacts (hit, metal or slam by force), horn, pickups and the base clank play samples, with the old synth as the
  fallback. New sounds with no synth behind them: door and engine start / stop when getting out and in, a turbo
  rev, menu button clicks, zombie groans and alien calls, wood / metal / glass when arena props break. The engine
  is the six loops mixed and pitched by revs (lower for diesel and burble engines). Rockets, harpoon, flamer,
  music, callouts and fuel sounds are still synthesized: the pack has no samples for them.

## Test hooks (`window.scrapwake`)
- `cdn.state()`, `await cdn.probe("zombie")`, `cdn.sounds()`, `cdn.horde()`
- `flight.state()`, `flight.mode(id)`, `flight.launch({ height, speed, pitch })`, `flight.aero(mass, halfX, halfZ, wings)`
- `sky.state()`, `sky.hour(h)`, `sky.weather(kind)`
- `check14()` returns `{ ok, results }` for flight, aim limits, side mounts, bindings and the sky.

## Not done
- The pack's `street_light`, `container`, `road_bits` and `watch_tower` models are not placed in the world yet.
- The rest of H (race lines round Brokeway's gaps, lobbies on "Your map") moves to round 15.

## Checked, and not checked
- The game builds cleanly. The manifest, every model's clip names and every sound file were read from the server.
  The two alien models were loaded through `cdnPack.js` outside the browser: heights 1.6 m and 2.1 m, feet on the
  ground, clips bound to the copied skeleton.
- Not run in a browser this round: `check14()`, the zombie models (they carry textures), how the samples and the
  engine loops sound, and their loudness against the music. The engine loop mix assumes the six loops are ordered
  from low revs to high.
- The server answered cross-site requests from every origin tried (the published site, a preview-style host and
  localhost). If it ever refuses, the game falls back to built figures and synth sound and `cdn.state()` shows the
  error.
- `game/game.js` is 310 lines, over the 300 line rule.
