# Moving machines and walkers (round F)

## What it is
Any free-build car with a **Transform Core** gets a rig. Keys **1-9** move bound joints and blend saved poses,
**T** folds the machine between **Drive** and **Walker** mode, and in Walker mode it walks on 2 or 4 legs, leaves
footprints, shakes the ground on heavy steps, fires its weapons and throws its ram fist (**J**).
The ready-made heavy walker is the **Wreckframe** (`src/game/mech/wreckframe.js`).

## Files
- `mech/mech.js` — `game.mech`: per-vehicle state, keys, transform, walking, fist, HUD snapshot, `rideWreckframe`.
- `mech/rig.js`, `rigData.js`, `pose.js` — procedural rig from the free-build parts; fold blend and joint poses.
- `mech/walk.js`, `gait.js`, `footprints.js` — kinematic walking (walkers skip car physics), leg cycle, prints.
- `mech/transform.js` — T rules (core, legs, upright, slow), the fold, the standing hit box, drop back onto wheels.
- `mech/fist.js`, `weaponModels.js` — ram fist punch; heavy walker weapon models.
- `mech/keys.js`, `hooks.js` — joint keys 1-9; `window.scrapwake.mech` test hooks.
- `mech/check.js`, `checkData.js` — the scripted `?mechcheck=1` run.
- Workshop side: `workshop/free*.js` (parts, validate, edit, layout, compile, bill), `workshop/torso.js`.
- UI: `ui/MechHud.jsx`, `ui/workshop/Free*.jsx`, `JointsPanel.jsx`, `PosesPanel.jsx`, `ui/MechCheckLast.jsx`.

## Rules
- T needs a Transform Core and 2 or 4 legs, the machine upright and under ~22 km/h; folding back needs feet down.
- The fold takes 1.2 s; time never slows. The chase camera pulls back as the walker stands up.
- Part cap: 300 on High/Ultra, 150 below (editor), hard cap 300 in validation, so imports cannot exceed it.
- A design without free parts has no `free` key: old v1 blueprints and today's cars compile exactly as before.
- Spawn Wreckframe is admin only (Base44 admin role or the local developer flag); the action refuses everyone else.
- No guns inside safe zones applies to walkers too (weaponsGate runs after every controller).

## Checking it
Open `/?mechcheck=1`. The game skips the intro, moves 110 m down the highway out of the Well-town, and runs
24 checks through the same paths the keys use; the walker HUD card lists each one and ends with PASS or FAIL.
The result is also saved and shown from the first frame of the next `?mechcheck=1` load, and
`window.scrapwake.mech.check()` returns it. In this mode only, the simulation runs 4x so the run finishes quickly.

Checked: compile with a core, two legs stand, reactor carries it, symmetry twin, undo, share code round trip,
blueprint save and reload, part cap, old v1 blueprint, all 7 presets unchanged, admin-only spawn, fold into Walker
mode, standing hit box, walk, footprints, hip height, turn, jump and land, fire, Guard pose on key 1, ram fist,
fold back, car physics resume, no script errors. Last run: **24 / 24 PASS, 0 errors**.

## Final pass
Production build succeeds and lint is clean on the mech, loop, game and mech UI files. Script errors were taken
from the last check run (0); the browser console was not opened separately.

## Not checked
- Four-legged walkers (the scripted run uses the two-legged Wreckframe).
- Gamepad controls for joints, T and the fist.
- Building a walker from scratch by hand in the Workshop editor (the check builds it through code).
- Online play with a walker, and walkers in arenas.
- Frame rate on a real machine.

## Known limits
- Frame rate under a full 300-part build was not measured in the headless preview (its FPS is not representative);
  the cap is what protects it. Check on a real machine with `&debug=1`.

## Round 12 summary
- Online: a player's machine sends its mode, fold and every joint value inside the car state's `parts` object
  (`net/mechNet.js`, no server change). Others see the same machine (Wreckframe or Scuttler; other custom builds show
  as the stock 2- or 4-legged one) fold, stand and move its joints, with the standing hit box.
- Arenas: horde figures reach a standing walker at its feet, not its hips. Turrets and AI aim at its body as before.
- Gamepad: while driving a machine with joints, hold LB: D-pad up/right/down/left = joint keys 1-4, A/B = 5/6,
  Y = T (fold), X = ram fist. LB alone still changes camera (on release). Without a machine nothing changes.
- New preset: the Scuttler, a four-legged medium walker (Workshop free build: Load Scuttler; hook `mech.scuttler()`).
- The check list moved off the walker card into the right-hand panel; the card shows a count only.
- `?mechcheck=1` adds 11 round-12 checks (`&from=quad` runs only those). Last run: all pass, 0 script errors.
