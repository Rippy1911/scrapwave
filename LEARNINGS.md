# Scrapwake: learnings

What building this game taught us: Base44 builder rounds plus direct-code lanes, 9–10 Nov 2026. Newest entries go at the top of each section. Keep this file current with every merge.

## Shipping on Base44
- **Live preview host:** `https://preview--scrap-wake-drive.base44.app/`. The old `preview-sandbox--<appId>.base44.app` host answers 503.
- **Never push or merge to main while a builder run is open.** Read the editor textarea's placeholder first: "Anything else while you wait?" means a run is open, "What do you want to change?" means idle.
- **Merge with `gh pr merge`.** A direct `git push origin <branch>:main` and a force-push were both refused by the permission check; `gh pr merge` works. Update a PR branch by merging main into it, never with rebase plus force-push.
- **Builder pushes:** the builder commits "File changes" to main every couple of minutes during a run. The editor shows "Synced N commits from GitHub" after our merges, and the preview serves the new build a few minutes later. Check that `window.scrapwake.physics` (or another new hook) exists before you test live.
- **Client-only game:** the app is TanStack Start with SSR on Cloudflare. The game loads client-only (`ClientOnly` plus `lazy(() => import(GameRoot))` in `src/routes/index.jsx`). That is why Rapier's WASM `init()` on import is safe and the server bundle stays small.

## Driving the builder
- **One small file per step:** say "Plan briefly, then write: one small file per step." A file map plus "Your FIRST action is to write X" halves the first think.
- **Checkpoints:** say "Go through A to G in one run; they are checkpoints, not places to stop." The builder still pauses sometimes with "Write 'continue' to keep going". Base44's own "Running checks – fixing an issue" follow-ups can fix a broken import for free.
- **Do-not-touch lists:** a do-not-touch list naming every file that a direct-code lane is changing kept builder rounds and PRs mergeable. Rounds 4–6 hit only a single `hooks.js` conflict each (a union).
- **The builder cannot run a browser test:** it has no test browser. Ask it for hooks (`window.scrapwake.*`) and run the checks yourself, headless.
- **Reload before you call a run stuck.** An open editor tab can freeze its display: "Planning next steps... 21k chars" sat still for 8+ minutes while the run was really writing files.
- **Costs:** six builder rounds (first build, fixes, fuel and replays, online, bases, polish) used about 52 credits. Physics, graphics, the room server and the assets were direct-code lanes and cost 0 credits.

## Physics (Rapier 0.21, ray-cast vehicle)
- **Heightfield:** the terrain heightfield must match the render mesh's triangle split. `checkHeightfield()` measures it; ours is within 0.0001 m.
- **Remote cars:** network cars (`v.remote`) are kinematic bodies moved to their interpolated pose. They still have to go through `stepVehicle`, or other players have no collision.
- **Disabled bodies:** a car respawned on top of a ramp collider sometimes came back from Rapier *disabled*, frozen in place while reporting speed. Re-enable it before each step (`if (!rb.isEnabled()) rb.setEnabled(true)`). This froze the demo reel's whole bridge segment.
- **Hidden instances must not collide.** Colliders follow the quality density per instanced model group.

## World
- **Bridge decks:** a flat deck at the higher bank's height left an 18 m wall at the low end. The fix:
  - the road climbs to the deck at no more than 14%, with an 8 m level landing;
  - the first and last 6 m of a bridge blend the ground into the deck;
  - raised roads get side slopes of about 1:2.2 instead of cliffs.
- **Keep ramp lanes clear:** no colliding scatter (rocks, husks, tarp wrecks) within 45 m before a ramp foot, 40 m past the lip and 3 m either side (`inRampLane` in `places/ramps.js`). A headless run at every ramp found tarp wrecks on two run-ups and the car-carrier tractor parked in front of its own foot, so all four carriers were unjumpable.
- **Ramps sit level, so fit them to the ground:** base each ramp on the lowest ground under its footprint, and make the lip stand its height above the higher end. Slide a road ramp off any spot steeper than 12% along or across to the nearest flat spot up to 60 m along the same road, same side and offset (roads.js `alts`); open ramps slide up to 40 m along their line or 8 m sideways. A straight-line slide put the rail bus ramp onto the rail bed. Unfitted ramps stood up to 1 m proud, floated up to 7.7 m, or became 15–41 m towers on mesa faces.
- **AI ramp runs:** approach on the road behind the ramp, and give up after 2 s under 3 km/h.

## UI
- **Custom component classes go in `@layer components`.** Unlayered, `.sw-panel { position: relative }` comes after Tailwind's utilities in the built CSS (the live preview's `index-Bdwjfyrf.css` is byte-identical to a local `vite build` of main: `.absolute` at byte 7,506, `.sw-panel` at 43,157). Same specificity, so the later rule wins and every `absolute` HUD panel fell into a full-width band. Base44 does not reorder the CSS: every production build of that source draws the HUD this way, so test layout on a local `vite build`, not `vite dev`. In `@layer components` Tailwind emits it before the utilities.

## Testing and recording
- **Isolate each worktree's dev server.** Dev servers in worktrees that share one `node_modules` through a symlink also share `node_modules/.vite` and keep re-optimizing each other. Give each worktree an APFS clone instead: `cp -cR ../gfx/node_modules ./node_modules` takes about 80 s. The desktop app also caps dev servers at 5 per folder.
- **Machine load:** at load averages of 200–350 (seven sessions, several headless browsers) fps numbers mean nothing. Compare before and after alternately under the same load, and measure fps on real hardware.
- **Demos:** record with `record4.mjs` (virtual time, 30 fps). Scripted segments through the test hooks (setPose, spawn, base.*, cycle.skipTo) make a better demo than the built-in reel. Check stills from every segment before you trust a take.
- **Online:** two separate browser contexts joined the live room server through the title button and name card. They landed in the same shard with one host, and the host handed over when it left.
