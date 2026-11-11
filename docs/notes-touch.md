# Touch controls

Phones and tablets (coarse pointer) get touch controls automatically; `?touch=1` forces them on desktop.
Desktop without `?touch=1` is unchanged.

## Files (src/game/ui/touch/)
- `detect.js` — coarse pointer / `?touch=1` detection (`isCoarsePointer`, `isMobileDevice`).
- `prefs.js` — saved settings: button size, stick size, left-handed, show controls.
- `state.js` — shared touch state: stick axes, held buttons, look deltas, one-shot edges (trapDrop, pause).
- `controller.js` — `game.touch`: merges touch into the input action stream (`input.js` reads it like a gamepad).
- `TouchControls.jsx`, `TouchStick.jsx`, `TouchButton.jsx`, `LookPad.jsx` — the on-screen layer, per mode.
- `TouchSettings.jsx` — Touch section in the pause menu. `RotateCard.jsx` — portrait warning.
- `touch.css` — `.sw-touch` scoped HUD layout (safe areas via `env(safe-area-inset-*)`).
- `hooks.js` — `window.scrapwake.touch` test hooks.

## Modes
- Drive: stick steers; throttle, brake (brake + hard steer drifts), turbo, fire, rockets, trap. Aim is always assisted.
- Foot: stick walks; use, jump, call car. Swipe the right half to look.
- Air: stick pitches/rolls (W A S D); up, down, exit.

## Defaults
- Phones and tablets start on the Low quality preset until the player picks one.
- Viewport: `viewport-fit=cover`, no pinch zoom.

## Pause
- Single player: Esc, P, the touch pause button or losing focus pause the world.
- Online: the same keys open the menu ("MENU") but the world keeps running; the player's car is held idle while it is open.
