# Bases: free-build pieces, blueprints, raids, fortresses

## What is built
### Pieces
- Catalog `base/pieceCatalog.js`: wall, half wall, barrier, gate, ramp, platform, pillar, tower, bridge, crate, barrels, sandbags, lamp post (+ fortress-only core and turret). Cap: 120 per plot, 700 in the world.
- Materials `base/materials.js`: wood, sheet metal, concrete, steel, tiers I-III. HP, mass and cost scale with piece volume. Resistance per hit kind (`mg | rocket | mine | ram | blast`): MG fire barely chips concrete and steel.
- World `base/pieces.js`: colliders, damage by kind, crack/hole/smoke looks (`pieceDamage.js`), debris on break (`debris.js`), unsupported pieces fall (`support.js`) and take/deal fall damage.
- Explosions: `combat.explode(..., weapon)` passes the weapon to `base.blast` (rockets → `rocket`, mines → `mine`, else `blast`).
- Cars (`pieceWorld.js`): rams damage pieces (speed lost × mass), gates open for the plot owner, owners can't hurt their own base, raiders can't hurt their own fortress.

### Build view (B on your plot)
- Pieces tab: material (1-4), tier (T), palette, piece cap meter, Repair (pays for every damaged piece, most-hurt first), Undo/Redo.
- Keys: R rotate (15° in fine mode), F fine, C copy, V paste, X / Delete remove (half refund), Ctrl+Z / Ctrl+Y.
- Modules tab: original turrets, traps and pads; "Last cycle" re-stamps last cycle's module layout.
- Blueprints menu: save, load (rebuilds only missing pieces, charges only for those), rename, delete, copy share code (`SWB1.`), import.

### Raids
Raiders blocked by a built piece rocket it from range, ram it, back off and ram again (`raids.js` `breachPiece`).

### Fortresses (`fortress.js`, `fortSites.js`, `fortressLayouts.js`, `fortTurrets.js`, `fortGuards.js`)
- Rustjaw Keep, Cinder Hold, Gutter Bastion on the flattest clear ground near their map spot, gate facing the nearest road.
- Tower turrets (host aims), three guard cars, a core. Wrecking the core: big blast, 1200 scrap in crates, +400 bounty. Rebuild 5 min later once nobody is within 160 m.
- HUD fortress card within 160 m: core %, walls, guards, rebuild timer.

### Online
`pieceNet.js` relays `pcAdd`, `pcDel`, `pcFix` and summed `pcHit` damage (5×/s) from the browser that dealt it. Fortresses are built on every browser with the same ids.

### Hooks (`window.scrapwake.base`)
`pieces(group?)`, `place(spec, free)`, `remove(id)`, `hitPiece(id, amount, kind)`, `blast(x, z, dmg, weapon)`, `repair()`, `repairCost()`, `blueprints.{list,save,load,rename,remove,missing,exportCode,importCode}`, `forts()`, `breakFort(id)`, `rebuildFort(id)`, `check()`.

### Self-check
`await scrapwake.base.check()` → `{ pass, results }`. Claims a plot if needed, then: concrete resists MG vs rockets, stacking, falling after the support breaks, repair cost and repair, blueprint save / share-code round trip / missing count / partial rebuild, three fortresses with cores and turrets, core wreck drops a fortress. Removes the pieces it built (the wrecked fortress rebuilds on its normal timer).

## Verified
- Production build passes with no errors.
- Lint: 0 errors. Remaining warnings are "unused" reports on components and icons used only in JSX (the lint config has no JSX-usage rule), plus older ones outside this work. Removed the one real unused import in `base.js`.
- Game boots and drives in `?autoplay=1` with everything wired (one screenshot, before this pass).
- Server render of `/` returns 200 with no server console output.

## Not checked
- Browser console during play (no screenshots or browser run this pass).
- `scrapwake.base.check()` has not been run; its results are unknown.
- Build view by hand: placement preview, snapping, copy/paste, undo/redo, blueprint menu, share-code import.
- Falling/debris visuals, damage looks, ram damage feel, gate opening.
- Raiders breaching built walls in a real raid; fortress guards and turrets in a fight; the rebuild timer.
- Online: two browsers placing/damaging pieces, fortress sync. Known gaps: late joiners don't get pieces placed before they joined; fortress rebuild timers run per browser.
- Touch controls in the build view; performance with many pieces on Low quality.
