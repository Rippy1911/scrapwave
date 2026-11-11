# Scrapwave

Original post-apocalyptic vehicle combat in your browser. Drive armed buggies,
brawlers and bikes across a dust-choked wasteland, take to the air off ramps,
hunt zombie and alien hordes in the arena, raid convoys and claim a plot to
build and defend your own base before the storm closes in. Play solo or share
the world online with other drivers.

This is the public source of Scrapwave, refreshed at each release. Day-to-day development happens in a private repo that syncs to Base44, where the game is hosted.

## Play

https://scrap-wake-drive.base44.app

## Features

- Open-world driving with weight, drift and a turbo, plus aircraft and on-foot play in safe zones
- Assisted aim, guns, rockets, harpoon, and oil, spike and mine traps
- Arena fights against hordes and AI drivers with skill levels
- Bases: claim a plot, build walls, turrets, a refinery and radar, survive raids
- Radio jobs, daily contracts, the water convoy and the rare Warlord
- 30-minute cycles that end in a dust storm, with a results screen
- Online shared world with chat, emotes and a weekly ladder; or single player
- Touch controls, quality presets, instant replays and a demo reel

## Controls

- Drive: **W A S D** (or the arrow keys); **Space** is the handbrake slide
- In the air: **W / S** pitch, **A / D** roll, **Q / E** spin, **Space** levels out (W A S D work in the air too)
- Guns **LMB / J**, rockets **F / K**, harpoon **E**, traps **G** drop and **H** cycle
- Base: **B** build view on your plot, **R** rotate, **Esc** leave
- Online: **Enter** chat, **T** emotes, **Tab** scoreboard

The in-game Controls panel lists the rest.

## URL test hooks

Scripted checks, read in `src/game/game/modes.js` (add `=1`):

- `?selfcheck=1` scripted fuel, pump, replay and demo-reel check (add `&debug=1` for the overlay)
- `?autoplay=1` autopilot with a cinematic camera; `?test=1` fixed-seed scenario
- `?debug=1` FPS and collider overlay; `?mechcheck=1`, `?bikecheck=1`, `?racecheck=1` scripted checks
- `?quality=<preset>` picks a graphics preset for that visit

In the browser console, `window.scrapwake` exposes helpers (`state()`, `teleport()`, `spawn()`, `demo(on)`); see `GAME_NOTES.md`.

## Run it

```bash
npm ci
npm run dev
```

It is a Base44 TanStack Start app. The game itself is client-side (Rapier physics,
three.js rendering) and saves progress in the browser, so single player runs
without Base44 credentials. Base44 backs the sign-in pages, feedback and crash
reports, which need `VITE_BASE44_APP_ID` and a linked app (`base44 login`,
`base44 link`, `base44 dev`). Online play connects to the hosted room server.

## Stack

three.js, Rapier (`@dimforge/rapier3d-compat`), React 19, TanStack Start, Vite,
Tailwind and Radix UI, Base44 SDK.

## Credits and licence

Art, models, textures and HDRIs are CC0 and credited in [`CREDITS.md`](CREDITS.md).
Code is MIT, see [`LICENSE`](LICENSE).
