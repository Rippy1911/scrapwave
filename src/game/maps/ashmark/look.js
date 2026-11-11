// The look of each Ashmark biome: its weather (fog, tint, light and rain all hang off the weather in
// world/sky/weather.js) fades in once the camera has been in the biome for a few seconds. Clear over the flats and
// the Spine, grey haze in Old Varrow, blowing dust on the Sallow Sea, rain over the Drownings. A match whose rules
// set a weather keeps it. Leaving the Ashmark puts back the weather rule that was running before.
import { biomeAt } from "@/game/maps/ashmark/height";
import { DEFAULT_RULES } from "@/game/rules/gameRules";
import { getRules } from "@/game/rules/state";

export const BIOME_WEATHER = { waste: "clear", city: "fog", spine: "clear", dunes: "dust", marsh: "rain" };
const SETTLE = 3, CHECK = 0.5; // seconds in a biome before its weather starts, and between looks at the camera

export function createLook(game) {
  let saved = null, biome = null, seen = null, seenT = 0, t = 0, changes = 0;
  return {
    set(active) {
      if (active && saved === null) saved = game.skyCycle.state().weatherRule;
      if (!active && saved !== null) { game.skyCycle.setWeather(saved); saved = biome = seen = null; }
    },
    /** Every rendered frame while the Ashmark is active; real is wall time. */
    frame(real) {
      t -= real;
      if (t > 0) return;
      t = CHECK;
      const c = game.camera.position, b = biomeAt(c.x, c.z);
      if (b !== seen) { seen = b; seenT = 0; } else seenT += CHECK;
      if (getRules().weather !== DEFAULT_RULES.weather) return;
      const first = biome === null;
      if (first || (seen !== biome && seenT >= SETTLE)) { biome = seen; changes++; }
      const want = BIOME_WEATHER[biome];
      if (game.skyCycle.state().weatherRule === want) return;
      if (first) game.skyCycle.setWeather(want); else game.skyCycle.fadeWeather(want); // the map opens in its look
    },
    stats: () => ({ biome, weather: biome ? BIOME_WEATHER[biome] : null, changes }),
  };
}