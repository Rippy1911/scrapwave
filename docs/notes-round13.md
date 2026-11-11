# Round 13: wings, showcase, map builder, Wreck Race, photo mode, feedback

## What was added
- **Wings and the Showcase fleet** (earlier in the round): `vehicles/wingFlight.js`, `vehicles/wingMesh.js`,
  `workshop/showcase.js`, `onfoot/showcaseRides.js`. The title screen has a Build button that opens the Workshop.
- **Map builder** (`ui/mapbuilder/`, `arena/custom/`): Custom Game > Map builder. A top-down plan of the pen; pick a
  piece, tap to place, R or Turn rotates in 45 degree steps. Walls, blocks, towers, decks, pillars, glow pylons, two
  ramps, smashables and markers (start spot, checkpoint, power-up, horde nest). Up to 220 pieces and 12 saved maps
  (localStorage). Missing start spots and checkpoints are filled in. Maps share as a code ("SWM1...").
- **The pen** (`arena/custom/penMap.js`, `field.js`): a fourth arena site, an empty walled pen. Data maps are laid into
  it at match start and cleared for the next one. "Your map" and the three race tracks all play there.
- **Wreck Race** (`arena/race.js`, `arena/custom/tracks/`): win rule "race", with a laps rule (1 to 9). Laps round the
  rings against the AI with guns live; a wrecked car comes back at its last ring. An AI finishing first ends the match
  ("BEATEN"). Tracks: Foundry Pen (oval), Glowfield (figure of eight), Brokeway (two broken raised roads). Three
  presets and a Wreck Race button on the title screen.
- **Online** (`net/rideNet.js`): other players now see your showcase vehicle and your wings. Sent inside the car
  state's `parts` object (`ws`, `w0..w3`), so the room server is unchanged.
- **Touch building** (`base/buildTouch.js`, `ui/build/BuildTouchRow.jsx`): a Build button appears on your plot or at
  the garage; in build view drag to aim, lift to place, with Turn, Remove and Put down buttons.
- **Photo mode** (`photo/photoMode.js`, `ui/PhotoBar.jsx`): O while playing. Free camera within 140 m of the car,
  zoom and tilt, Enter or Snap saves a PNG without the HUD. Freezes the world in single player only.
- **Feedback card** (`ui/feedback/`, `Feedback` records, `sendFeedback` server function): shown beside arena and
  cycle results, and in the open world after 35 s resting in a safe ring (on the next menu; at once on touch).
  Not asked again for a week after sending, or a day after "Not now". Records are readable by admins only.

## Test hooks (window.scrapwake)
`maps.list() / current() / save(map) / code() / fromCode(code) / layout() / play()`, `race.start(map, { laps, ai })`,
`race.state()`, `photo(on)`, `photoState()`, `rideNet()`, `check13()`.

## Final pass
Production build succeeds and lint is clean on `src/game` and `src/lib`. New files are all under 300 lines.

## Not checked
- None of this round was played in a browser: `check13()` was not run, the three tracks were not driven, and the AI's
  line round Brokeway's gaps and Glowfield's crossing was not watched.
- The feedback card was not submitted end to end.
- Online showcase and wings with two real clients; touch building on a real phone; the saved PNG from photo mode.

## Known limits
- Your own maps and the race are single player (hosting a lobby on "Your map" is refused). In a lobby the race tracks
  load, but each client counts its own AI, so race results can differ between players.
- Race AI steers straight at the next ring with no path finding; it relies on reversing out when stuck.
- On Glowfield the first ring is on the start line, so cars at the front of the grid pass it at once.
