// Day, night and weather for one game (round 14): reads the Time of day, Day cycle, Weather and Wind rules, steps
// the clock and the weather every rendered frame and writes the look into the sky. A trailer or photo call to
// sky.setTimeOfDay("dusk") holds this off until it asks for "day" again.
import { RENDER } from "@/game/data/tuning";
import { onFrame } from "@/game/render/frame";
import { WIND } from "@/game/render/wind";
import { getRules } from "@/game/rules/state";
import { createDayClock, sunElevation, sunAzimuth, phaseOf, clockText } from "@/game/world/sky/dayClock";
import { createWeather } from "@/game/world/sky/weather";
import { applyDayLook } from "@/game/world/sky/dayLook";
import { createStars } from "@/game/world/sky/stars";
import { createRain } from "@/game/world/sky/rain";

export function createSkyCycle(game) {
  const sky = game.sky, scene = game.scene, renderer = game.rend.renderer;
  const clock = createDayClock(), weather = createWeather();
  const stars = createStars(scene), rain = createRain(scene);
  let key = "", held = false, night = 0, elev = RENDER.sunElevation;

  const setTime = sky.setTimeOfDay;
  sky.setTimeOfDay = (mode, az) => { held = mode !== "day"; setTime(mode, az); };

  function readRules() {
    const r = getRules(), k = `${r.timeOfDay}|${r.dayCycle}|${r.weather}|${r.wind}`;
    if (k === key) return;
    key = k;
    clock.set(r.timeOfDay ?? 9, r.dayCycle || "normal");
    weather.set(r.weather || "random", true);
    WIND.mul = Math.max(0, Math.min(2, r.wind ?? 1));
  }

  const off = onFrame((cam, dt) => {
    readRules();
    const step = game.loop && game.loop.paused ? 0 : Math.min(dt, 0.1);
    const hour = clock.step(step), W = weather.step(step);
    elev = sunElevation(hour, RENDER.sunElevation);
    if (!held) night = applyDayLook(sky, renderer, scene, elev, sunAzimuth(hour, RENDER.sunAzimuth), W);
    stars.update(cam.position, held ? 0 : night * W.stars);
    rain.update(cam.position, step, W.rain);
    if (W.thunder && game.audio && game.player) game.audio.explosion({ x: game.player.pos.x + 140, y: game.player.pos.y + 60, z: game.player.pos.z + 90 }, 2.2);
  }, scene);

  return {
    state: () => ({ hour: +clock.hour().toFixed(2), clock: clockText(clock.hour()), phase: phaseOf(elev), sunElevation: +elev.toFixed(1), night: +night.toFixed(2),
      weather: weather.kind(), weatherRule: weather.mode(), rain: +weather.out.rain.toFixed(2), wind: WIND.mul, fog: +scene.fog.density.toFixed(5), cycleHoursPerMin: +(clock.rate() * 60).toFixed(2) }),
    setHour(h) { clock.setHour(h); },
    setWeather(w) { weather.set(w, true); },
    fadeWeather(w) { weather.set(w); }, // the same rule, but the look fades in (the Ashmark's biomes: maps/ashmark/look.js)
    dispose() { off(); stars.dispose(); rain.dispose(); sky.setTimeOfDay = setTime; },
  };
}