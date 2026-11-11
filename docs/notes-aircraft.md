# Aircraft notes

Two aircraft live in `src/game/air/`, kept apart from car physics. Each one is a kinematic body (`body.js`) moved by `flight.js`, not by Rapier, so car physics files are untouched.

## The two aircraft
| | Scrap Hornet (helicopter) | Dust Devil (jet) |
|---|---|---|
| Who | Any player, after unlocking | Admin only, never offered to normal players in any mode |
| Hull / top speed | 300 / 160 km/h | 520 / 520 km/h |
| Weapons | Chin guns 40 dps, 2 rockets (8 s reload) | Guns 95 dps, 4 rockets (5 s reload) |
| Fuel | 80-unit tank, burns 2.4x car rate (3.2x fast) | None |

## Controls (flight keys in `keys.js`; arrow keys never fly)
- Helicopter: W/S nose forward/back, A/D strafe, Q/E yaw, Space climb, Shift descend. It holds a hover with no keys held, and has a ceiling and soft landings.
- Jet: W/S pitch, A/D bank and turn, Q/E yaw, Space boost, S lifts off from a road. It never stalls and has an air brake.
- Both: mouse aims, LMB guns, F rockets, X gets out (only when landed and slow). Your car is parked beside the aircraft while you fly.
- Cars in the air still use W/S pitch and A/D roll only (`physics.js airControl`, `input.js`). The arrow keys never reach car air control.
- Time always runs at 1x: no slow motion and no hit-stop anywhere, replays included.

## Getting the helicopter (`progress.js`, `economy.js`, `tiers.js`)
- Unlock: 25,000 banked scrap plus high rank, meaning the Warlord beaten or 40 jobs and contracts finished. Both counters start from the aircraft update; older saves start at 0.
- Running costs: 400 scrap daily upkeep, charged at the first launch of each day. Repairs cost 3 scrap per HP. It refuels only at outposts (fuel stops) and your own base plot.
- Upgrades: armour, rotor and engine, chin guns, rocket pods, and fuel tank. Each has 3 tiers at +22% per tier, priced at 1x, 2.5x and 6x the base price.
- Hull, fuel and tiers are saved in `save.air`. When it's shot down it's a wreck (0 HP) until repaired in the garage.
- Garage: the "Aircraft" section shows what's still needed and a Buy button, then Repair, Upgrades and Fly. Fly closes the garage and launches through `game.air.spawn("heli", { admin: false })`, so even admins pay upkeep from there.

## Combat and shoot-down
- Aircraft use the shared weapons code. Cars, AI and base turrets can hit them.
- Rocket lock-on uses line of sight (`sight.js`), so it never locks through hills or walls.
- At 0 hull the aircraft spirals down, explodes and leaves a wreck. You respawn at the road, and the parked car is lost.

## Admin
- An admin is either the app's admin login (`user.role === "admin"`, set by `AdminLayer`) or the local developer switch `window.scrapwake.admin(true)` (this browser only).
- Panel: F10 or the small "Admin · F10" button at the top centre, shown only to admins while playing. It can spawn any car, the helicopter or the jet; give 1k, 10k or 50k banked scrap; open the rules screen (Custom Game), where Play restarts with those rules; toggle god mode; and teleport to any place.
- Every action in `adminActions.js` re-checks `isAdmin()`.

## Test hooks
- `window.scrapwake.air`: `spawn(kind, opts)`, `state()`, `exit()`, `hold(ctl, t)`, `status()`, `buy()`, `tier(id)`, `repair()`, `rank({ jobs, warlord })`.
- `window.scrapwake.admin(on)`: turns the local developer admin switch on or off.

## Fixes made while wiring this
- `hud.js` had two `air` keys. The car airtime counter was overwriting the flight panel data, so the flight data is now `hud.flight`.

## Still to test by playing
- Helicopter: hover, landing and refuelling at an outpost and at the base.
- Jet: take-off from a road.
- Shoot-down by AI and turrets.
- Unlock and upkeep with a fresh save.
- Admin panel actions with an admin account.