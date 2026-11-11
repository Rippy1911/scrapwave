# Workshop notes

The Workshop lets you build a car (or bike) from parts, upgrade parts through three tiers, and save, share and import blueprints.
Code: `src/game/workshop/*` (logic) and `src/game/ui/workshop/*` (screens). It plugs into the game through `game.workshop`
(created in `game.js`), `playerCar.js` (`makeCar` / `fit`) and `hooks.js` (`window.scrapwake.workshop`). Physics and
vehicle code are untouched: no slow motion, no hit-stop, air control stays on W A S D.

## Tiers
| Tier | Name | Price | Main stat | Unlock |
|---|---|---|---|---|
| I | Scrap | ×1 | base | always |
| II | Welded | ×2.5 | +22% | 15 jobs & contracts, or 10,000 scrap banked in total |
| III | War-forged | ×6 | +48% | 40 jobs & contracts, or 25,000 scrap banked in total |

- Upgrading pays the price difference; going down or selling refunds half.
- Custom-game rules can cap tiers (`rules.maxTier`); the save keeps what you bought.
- Weapon tier entries keep today's def shape: damage per second steps by exactly +22% / +48%, range +8% / +15%, reload −8% / −15%.
- Armour uses the same tiers. **Balance change:** Plate went from 300 to 185 HP per zone and Forged from 450 to 222 (weight unchanged).
- Looks: Tier II adds welded seams and hazard stripes, Tier III dark riveted steel with glowing strips (weapon mounts, ram, armour).

## Where to find it
- Garage → **Workshop** button: turntable, part slots with I/II/III pickers, stats against your current car, build bill, blueprints, ready-made designs.
- Garage → **Bikes**: buy and ride the Dirt Bike, Chopper or Sidecar Rig directly.
- Garage → **Upgrade tiers**: engine, tyres, turbo, tank, ram, every owned weapon and module for the garage car.
- Picking a garage chassis switches back to the garage car; the Workshop's "Drive garage car" button does the same.

## Bikes
They lean and pull wheelies, and they throw the rider on a ram with a car close by, a hard landing or a rollover, with a fresh bike 3 s later.
A tail auto-turret fires at cars behind or beside you. Every bike has the trap drop slot.
Physics uses two wheel pairs on a narrow track; one wheel of each pair is drawn on the centre line.

## Checks run (this pass)
- Build: `vite build` passes, lint has no errors.
- Weapon damage per second, Tier I / II / III: MG 70 / 85 / 104, Scatter 160 / 195 / 237, Rockets 51 / 63 / 76,
  Harpoon 15 / 18 / 22, Flamer 50 / 61 / 74, Autocannon 110 / 134 / 163.
- 0–100 km/h by engine tier: Jackal 4.59 / 3.43 / 2.66 s, Brawler 5.80 / 4.15 / 3.16 s, Pickup 5.10 / 3.67 / 2.80 s,
  Dirt Bike 2.18 / 1.74 / 1.40 s, Chopper 2.55 / 2.04 / 1.65 s, Sidecar 3.33 / 2.62 / 2.08 s.
  Mammoth: top speed 90 km/h at Tier I (never reaches 100, shown as "—"); Tier II barely does (60 s); Tier III 6.6 s.
- Light vs six-wheeler: Jackal 1,111 kg, 134 km/h, brakes 14.8 m/s², ram 86 vs Mammoth 6,300 kg, 90 km/h, brakes 8.5 m/s², ram 706.
- Blueprints: save, revise by saving under the same name, duplicate ("… copy"), delete, share code round-trip all pass.
  Bad codes are rejected ("Not a Scrapwave blueprint code", "Code is damaged"); unknown parts and weapons are dropped, tiers clamped to I–III,
  and locked tiers are still refused at build time.
- Prices and unlocks: Tier II engine refused at 0 jobs, fitted for 600 after 15 jobs, stepping back down refunds 300. Chopper bought for 1,850.
- Today's cars: `physics.js` and `vehicle.js` are unchanged since before the Workshop; the garage chassis stats are unchanged (bikes only added);
  at Tier I `fitTune` leaves stats and weapon defs exactly as before.

## Fixed this pass
- The workshop save section was rebuilt on every read, so new blueprints and the "drive garage car" choice could be lost.
  `ensureWorkshop` now upgrades it once and returns the same object.
- The Workshop's "Drive garage car" button called nothing; it now saves the choice.
- The stats panel showed an empty value for "0–100" when a car can't reach 100 km/h; it now shows "—".

## Not checked yet
- Driving the bikes in the world (balance, throws, tail turret against live AI): needs a play session. Use
  `scrapwake.workshop.ride("dirtbike")`, `scrapwake.workshop.throwOff()`, `scrapwake.workshop.state()`.
- The browser console during a full garage → Workshop → build → roll out session. The title screen loads cleanly.

## Test hooks
`window.scrapwake.workshop`: `parts()`, `tiers()`, `design()`, `compile(d)`, `presets()`, `build(d | name)`, `upgrade(slot, tier)`,
`blueprints()`, `save(name)`, `load(name)`, `duplicate(name)`, `remove(name)`, `exportCode(name)`, `importCode(code)`,
`ride(kind | "garage")`, `throwOff()`, `state()`, `check()`. `scrapwake.spawn("chopper")` and `spawn("preset:Brawler")` spawn designs.