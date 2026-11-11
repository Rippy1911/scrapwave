# Round 11: factions, reputation and live menus

## Factions (src/game/factions/)
| id | name | built on | home / trader |
|---|---|---|---|
| drifters | Drifters | team `drifter` | caravan stall in the Well-town |
| well | Well-town militia | team `militia` + the Cisterner convoy | Well-town trader and job board |
| gasket | Gasket militia | team `militia`, `faction: "gasket"` | North Scrapyard outpost |
| raiders | Raiders | teams `rattler`, `warlord` | Rattler Scrapyard fence |

Files: `roster.js` (factions, posts, gates, `factionOf`), `reputation.js` (store and rules),
`relations.js` (who attacks whom), `repEvents.js` (what moves standing), `goods.js` (trade goods and prices),
`trader.js` (Trader menu data and actions), `jobCatalog.js` (faction jobs), `militia.js` (guard cars),
`gates.js` (town gates), `factions.js` (assembly), `hooks.js` + `check.js` (tests).

## Reputation
- Saved in `save.rep`, -100..100. Bands: Hostile ≤ -50, Wary ≤ -15, Neutral ≤ 14, Friendly ≤ 49, Allied.
- Moves on: wrecking or hitting a faction's cars, finished faction jobs, staying with the water convoy (or raiding it),
  selling goods a faction needs. Arenas, the demo reel and autopilot never move it.
- Changes are batched for 0.6 s into one toast ("+5 Gasket militia"); crossing a band shows a callout.
- Prices: Allied x0.8, Friendly x0.9, Neutral x1, Wary x1.2, Hostile no trade. Trap tiers use the same multiplier.
- Hostile: that militia attacks on sight and shuts its town gate. Friendly raiders leave you alone unless provoked
  (shooting or wrecking one provokes the faction for 20 s).

## Screens
- **Trader menu** (E at a trader or job board): Trade tab (goods, cargo hold of 6, restock traps / patch tyres,
  next trap tier) and Job board tab (locked jobs show the standing they need, rival jobs are flagged).
- **Map** (M, pad Back): north-up world map with faction territories, border points and the player, plus the
  Reputation panel. The pause menu shows the Reputation panel too.

## Online
- `ui/menuPause.js`: single player pauses for every menu; online, pause, garage, trader, map, spawn and results
  never stop the world. The car sits idle while a menu is open (`uiOpen`); only safe zones protect it.
- On foot: the scavenger's pose rides in the normal car state (`onfoot/footNet.js`), `net/remote.js` reads it and
  `onfoot/remoteWalkers.js` shows other players walking.
- Militia guards run on the host only; a new host adopts the old host's guards by `netId` (`am-<faction>-<n>`).

## Tests
- `window.scrapwake.factions`: `list()`, `rep()`, `set(id, value)`, `standing(id)`, `prices(postId)`,
  `trader(postId)`, `board(id)`, `take(kind, id)`, `militia()`, `skirmish(id)`, `fights()`, `walker(id, pose)`,
  `willAttack(vehicleId)`, `check()`.
- `?factioncheck=1` runs `check()` after 2 s and shows the result, plus the console error count after 20 s.
  Add `&autoplay=1` to also open the map at 5 s and the town Trader menu at 30 s. The check restores the save.
- Checks: wrecking raiders (militia up, raiders down), Allied/Wary/Hostile prices, a Friendly-only job,
  Hostile militia vs Friendly raiders, AI factions at war, online menus never freeze, on-foot pose round trip.
- Last run: all 7 pass, 0 console errors (fixed: guards drove before picking a patrol point).

## Round 12 summary
- Militia guards, Rattlers, Drifters and the autopilot now think before their first drive: no boot crash.
- All stunt ramps pass the run-up / foot / landing check (`?rampcheck=1`); ramp lanes are kept clear for 60 m.
- `?factioncheck=1` last run (with a walker check running alongside): all 7 pass, 0 console errors.
