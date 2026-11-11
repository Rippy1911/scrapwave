# Quick play (online)

The title's **Play now** button starts an ONLINE match. It reuses the custom-game lobby code (`docs/notes-lobbies.md`);
no new backend, no server change, no Base44 entity or function change.

## Player flow
1. **Play now** (asks for a driver name once, like every online start). The "Finding a match..." card opens with a **Cancel**.
2. It connects to the room server and listens for lobbies for up to 6 s (lobby hosts repeat their beacon every 5 s).
3. If an open public lobby for the default mode is heard, it **joins** it, picks your garage car when the rules allow it,
   and readies up. The host starts the match.
4. Otherwise it **creates** a public lobby ("Quick match · <name>", 6 seats), waits 10 s for drivers, then starts the
   match. The lobby's rules carry the **AI bots**.
5. Cancel at any point leaves the lobby, closes the connection and returns to the title. Esc is Cancel.
6. Offline, or the lobby service fails: the card says so plainly ("CAN'T GO ONLINE" / "NO MATCH STARTED", "Nothing was
   started.") with **Try again**, **Play offline** and **Back**. **Play offline** is the old local free roam; it starts
   only when pressed. Nothing local ever starts by itself.
7. The offline options under **Play** are unchanged: Free Roam → The Saltreach (solo), Arena, Wreck Race, Custom Game.

## Default mode
`QUICK.preset` in `src/game/lobby/quick.js`: the **Derby** preset (Quarry Bowl, wreck every opponent, 7 AI bots, 120 s),
with `QUICK.seats` = 6. Changing the mode is that one value (any preset name from `rules/presets.js`).
Which lobby counts as "open for the default mode": phase lobby, no code, a free seat, the same mode and map as the
preset, heard in the last 9 s. Quick lobbies win over hand-made ones, then the fuller lobby, then the lower ping.

## Two drivers pressing at once
A lobby we created and are still alone in gives way to a Quick lobby that has drivers in it, or at a tie the smaller
lobby id, so two drivers who press together end up in one lobby (`betterLobby` in `quick.js`).

## Code
- `src/game/lobby/quick.js`: the controller (`game.quick`: `start()`, `cancel()`, `state()`, `subscribe()`) and the
  pure picks (`pickLobby`, `betterLobby`). Built on `game.lobby`; it needs no lobby screen of its own.
- `src/game/lobby/lobby.js`: one new method, `listen()`, which connects and starts hearing lobby beacons without
  opening a lobby screen.
- `src/game/ui/lobby/QuickCard.jsx`, `useQuick.js`; `LobbyScreens.jsx` shows the card while Quick play is active.
- `src/game/ui/GameRoot.jsx`: `quickPlay()` and `quickOffline()`; `MenuFlow.jsx` passes `onQuick` to the Play now button.
- `src/game/lobby/quickCheck.js`: `?quickcheck=1` and `window.scrapwake.quick.check()`.

## Testing
- `?quickcheck=1` (keep the tab in front): runs the controller against a scripted lobby service with short timings and
  prints PASS or FAIL for `pick`, `join`, `join-fallback`, `yield`, `create`, `bot-fill`, `cancel` and `offline` in the
  `#quick-check` overlay and the console. It touches no network and starts no match.
- Two real windows: open the game in two browsers (or two origins such as `localhost` and `[::1]`, which do not share
  a driver name), give them different names, press Play now in both within a few seconds.
- `window.scrapwake.quick`: `start()`, `cancel()`, `state()`, `check()`.

## Limits
- The bots run on each browser (the arena AI is not shared; see `docs/notes-lobbies.md`). The lobby's rules are fixed
  when the lobby is created, so the bot count does not shrink when more drivers join.
- A lobby with a code or one made by hand that does not start itself can keep a Quick guest waiting; the guest gives
  up after 40 s with "That lobby never started the match." and offers Try again / Play offline.
- A lobby that is still alive on the room server after its host closed the tab can be listed for up to 16 s.
