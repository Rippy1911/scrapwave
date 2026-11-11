# Scrapwake menus

Every screen and every button, as a graph: `Button -> where it goes`. "(action)" means the button does something
and stays on the same screen.

## Before (round 14): what was wrong

- Title had "Custom game · Arena" and "Wreck Race" opening the same Custom Game screen, and "Hit the road · Online"
  and "Single player" starting the same world.
- Lobby browser and Host form went Back to the Title, not to the screen they were opened from.
- Pause and arena results had no way back to any menu or to another map (dead ends).

## Now (round 15)

One path down, one path back. Back always goes up exactly one level, and Esc is Back on every menu screen.
In play, Esc and P open Pause. The parent table lives in `src/game/ui/play/menuGraph.js`, the back-stack in
`src/game/ui/play/useMenuNav.js`, the screens in `src/game/ui/play/MenuFlow.jsx`.

```
Title
  Play now        -> Quick play, ONLINE (docs/notes-quick-play.md): "Finding a match..." with Cancel (-> Title);
                     offline or a failing lobby service shows a message with Try again / Play offline / Back.
                     Play offline = the old solo free roam (Choose your ride opens in the world), only when pressed
  Play            -> Play menu
  Build           -> Workshop                     Back -> Title
  Settings        -> Settings                     Back -> Title
  Demo reel       -> Demo (any key returns to Title)

Play menu                                         Back -> Title
  Free Roam       -> Map picker (The Saltreach solo, The Saltreach online)
  Arena           -> Map picker (Derby Bowl, Container Port, Quarry Pit, Crater Town; rule chips: Derby, Horde Night,
                     Checkpoint Rush, Low Gravity, Glass Cannons)
  Wreck Race      -> Map picker (Foundry Pen, Glowfield, Brokeway; laps 1-5)
  Custom Game     -> Custom Game
  Online Lobbies  -> Lobby browser (asks for a driver name first if none is set)

Map picker                                        Back -> Play menu
  Map cards, chips -> (action)
  Start           -> play (online roam asks for a driver name first)

Custom Game                                       Back -> Play menu
  Map builder     -> Map builder                  Back -> Custom Game
  Find a game / Host lobby -> lobby screens; leaving them returns to Custom Game
  Play            -> play

Settings: quality, volume, aim, touch, driver name, controls list.

Pause (Esc or P in play)
  Resume          -> play
  Restart         -> the same arena map from the start (arena matches only)
  Change map      -> Map picker for the mode being played
  Settings / Loadout -> tabs inside Pause
  Leave           -> the menu the game was started from (asks once)

Arena / race results
  Play again      -> the same map
  Next map        -> the next map of the same mode
  Back to menu    -> the menu the game was started from
Cycle results
  Next cycle      -> play
  Back to menu    -> the menu the game was started from
```

Map cards carry a picture of the map from above. Starting a world map (Derby Bowl, Container Port, Quarry Pit,
Crater Town) shows a short loading screen (map picture, blurb, landmark, tip) while `src/game/maps/loader.js`
swaps the world; leaving it puts you back in free roam where you left it.

Not yet in the flow: Stunt Parks and pre-game ride picking.
