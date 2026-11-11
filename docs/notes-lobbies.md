# Lobbies

Custom-game lobbies built on the room server's existing messages, with no server changes.

## Player flow
- Title → Custom Game → **Host lobby**: name, players (2–8), optional join code. The Custom Game rules become the lobby's rules.
- Title → Custom Game → **Find a game**: the lobbies heard in this room (name, mode, map, players, ping). Tap one to join. A locked lobby asks for its code. You can also join by code alone.
- **Invite link** (`?lobby=<id>&shard=<shard>&code=<code>`): opens the game and joins that lobby. A reload rejoins the tab's lobby (sessionStorage).
- In the room: player list (host crown, ready, ride), ride picker (garage car capped at the max tier, or a stock car; cars the rules don't allow are greyed out), chat, rules. The host edits the rules live, and each change clears the guests' ready flags. Guests see the rules read-only.
- The host presses **Start** once everyone is ready. Every browser plays the lobby's rules, each player at their own arena spawn slot.
- During the match, a bar at the top shows the lobby and round. The host can **End round** (open-world lobbies have no clock). Anyone can **Leave**.
- **Shared results**: each browser reports one line, and the host ranks them. The board closes when everyone has reported, or 25 s after the first report. The host takes everyone **Back to lobby**.

## Resilience
- If the host drops, the longest-standing player becomes host and keeps the lobby going.
- A dropped player's seat is held for 180 s. They get it back by id (the server's 60 s grace) or by name.
- Guests ask the host for a fresh snapshot when 30 s pass without one.

## Code
- `src/game/lobby/`: model (`lobbyState.js`), wire format (`wire.js`, `packing.js`, `transport.js`), host side (`host.js`), join (`join.js`), match runner (`match.js`), results (`results.js`), rides (`rideRules.js`), links (`session.js`), test hooks (`hooks.js`, `check.js`).
- `src/game/ui/lobby/`: `LobbyScreens` (router), `LobbyBrowser`, `HostForm`, `LobbyRoom` (`LobbyHeader`, `PlayerList`, `RidePicker`, `LobbyRules`, `LobbyChat`), `LobbyResults`, `LobbyBar`.
- Lobby screens count as menus: offline they pause the world, online the room keeps running (`ui/menuPause.js`).

## Testing
- `window.scrapwake.lobby`: `host`, `list`, `browse`, `join`, `ready`, `ride`, `rules`, `chat`, `start`, `end`, `back`, `leave`, `link`, `state`, `check`.
- Two windows: `/?lobbycheck=host&code=ABC12` in one and `/?lobbycheck=guest&code=ABC12` in the other. The check runs host Derby with a code → guest joins by code → rule change seen → ready → start → shared board → back to lobby. Results and console errors show in the `#lobby-check` overlay.
- `?lobbycheck=link` together with an invite link checks that the page joins on its own.

## What was checked
- `vite build` passes. ESLint shows no errors in the lobby, net, game and UI files. The unused-import warnings for components used only in JSX come from the project's ESLint config and appear in every UI file.
- The server render of `/` with a lobby link returns 200 with no console output.
- One preview window with `?lobbycheck=guest` opened Find a game in the room shard and started joining by code. No errors appeared on screen.

## What was not checked
- The full two-window run: host → join by code → rule change → ready → start → shared board → back to lobby. The preview opens only one window, so this needs two real browser tabs.
- Rejoining after a dropped connection, the host handing over when it leaves, and the 180 s seat hold.
- Invite links on a cold load (`?lobbycheck=link`), and an in-page reload rejoining the lobby.
- The browser console during a live match (only the server render was checked).
- The lobby screens on touch devices or narrow landscape (`?touch=1`).

## Needs a server change
- **Private rooms per lobby**: the server ignores a requested room name, so lobbies share the room shard. Other drivers in the room are hidden during arena matches (`game.netFilter`), but they stay in the open world.
- **Shared arena AI and horde**: only the room's shard host may stream AI, so arena opponents and the horde run separately on each player's browser. Players see each other's cars, but not the same AI.
- **Authoritative results**: each browser reports its own line. The host checks the values are in range but can't verify them.
- **Lobby list without beacons**: lobbies are announced over chat-channel beacons every few seconds. A server-side list would make browsing instant and work across rooms.
