// A world map's sky and light (round 15): its hour and weather while it is loaded, unless the match rules set their
// own. The day cycle (world/sky/skyCycle.js) re-reads the rules on the first frame after a match starts, so changes
// are applied two rendered frames later, after it; leaving puts the free-roam hour and weather back.
import { onFrame } from "@/game/render/frame";
import { DEFAULT_RULES } from "@/game/rules/gameRules";
import { getRules } from "@/game/rules/state";

export function createMapSky(game) {
  let saved = null, pending = null, wait = 0;
  const apply = (hour, weather) => { game.skyCycle.setHour(hour); game.skyCycle.setWeather(weather); };
  const off = onFrame(() => {
    if (!pending || --wait > 0) return;
    const p = pending;
    pending = null;
    if (p.restore) { if (saved) apply(saved.hour, saved.weather); saved = null; return; }
    const r = getRules(), own = r.timeOfDay !== DEFAULT_RULES.timeOfDay || r.weather !== DEFAULT_RULES.weather;
    if (!own) apply(p.hour, p.weather);
  }, game.scene);
  return {
    enter(look) {
      if (!saved) { const s = game.skyCycle.state(); saved = { hour: s.hour, weather: s.weatherRule }; }
      if (look) { pending = look; wait = 2; }
    },
    leave() { if (saved) { pending = { restore: true }; wait = 2; } },
    dispose: off,
  };
}