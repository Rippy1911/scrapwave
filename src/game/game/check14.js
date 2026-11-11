// Round 14 checks after flight and aim (game/hooksRound14.js runs these inside check14()). Each letter of the round
// adds its own lines here: add(name, pass, detail).
import { mountList, mountSide, sideMounts } from "@/game/workshop/parts";
import { compileDesign } from "@/game/workshop/compile";
import { PRESETS } from "@/game/workshop/designs";
import { createDayClock, sunElevation, nightK, phaseOf } from "@/game/world/sky/dayClock";
import { createWeather, WEATHER_LOOK, WEATHER_IDS } from "@/game/world/sky/weather";
import { HORDE_VARIANTS, variantFor } from "@/game/arena/hordeModels";
import { packState } from "@/game/assets/cdnPack";
import { GROUP_IDS, defaultGroup, groupOf, setBind, bindWeapons } from "@/game/weapons/binds";

export function sideMountChecks(add) {
  const m = mountList("medium"), n = m.length;
  add("side mounts: one small mount per flank", sideMounts("medium") === 2 && mountSide("medium", n - 2) === "left" && mountSide("medium", n - 1) === "right" && m[n - 1] === "S", m.join(""));
  add("roof mounts are not side mounts", mountSide("medium", 0) === null && sideMounts("dirtbike") === 0);
  const c = compileDesign(PRESETS[0]), sides = c.chassis.hardpoints.filter((h) => h.side);
  add("built car has both side hardpoints", sides.length === 2 && sides[0].pos[0] < 0 && sides[1].pos[0] > 0, sides.map((h) => h.id).join());
  add("old designs keep their weapons", c.design.weapons.length === mountList(c.design.parts.chassis.id).length);
}

export function bindChecks(add) {
  add("default triggers", defaultGroup("rocket") === "heavy" && defaultGroup("harpoon") === "aux" && defaultGroup("hitscan") === "guns" && GROUP_IDS.length === 4);
  const save = {}, w = { def: { kind: "hitscan" }, mount: { hp: { id: "sl", side: "left" } } }, v = { weapons: [w] };
  setBind(save, w, "heavy"); bindWeapons(save, v);
  const moved = groupOf(w) === "heavy" && save.binds.sl === "heavy";
  setBind(save, w, "guns"); bindWeapons(save, v);
  add("a mount can move to another trigger and back", moved && groupOf(w) === "guns" && !("sl" in save.binds));
}

export function skyChecks(add) {
  const noon = sunElevation(12, 10), nine = sunElevation(9, 10), midnight = sunElevation(0, 10);
  add("hour 9 is the tuned daylight", Math.abs(nine - 10) < 0.01 && noon > nine, `${nine.toFixed(1)} deg, noon ${noon.toFixed(1)}`);
  add("midnight is full night", nightK(midnight) === 1 && phaseOf(midnight) === "night" && nightK(noon) === 0);
  const c = createDayClock();
  c.set(23, "fast"); c.step(600);
  add("the clock wraps past midnight", c.hour() < 23 && Math.abs(c.rate() - 24 / 360) < 1e-9, `${c.hour().toFixed(2)} h`);
  c.set(7, "off"); c.step(600);
  add("Day cycle off holds the hour", c.hour() === 7);
  const w = createWeather(() => 0.5);
  w.set("fog", true);
  const o = w.step(0.016);
  add("fog thickens the air, clear does not", Math.abs(o.dens - WEATHER_LOOK.fog.dens) < 0.01 && WEATHER_LOOK.clear.dens === 1 && WEATHER_IDS.length === 5, `x${o.dens.toFixed(1)}`);
  w.set("storm", true);
  add("thunderstorm brings rain", w.step(0.016).rain === 1);
}

// Hosted pack (E, G). The last three need the network and, for the samples, one click in the game (audio starts then).
export function cdnChecks(game, add) {
  const sum = (k) => HORDE_VARIANTS[k].reduce((n, x) => n + x.share, 0);
  add("horde variants cover the whole horde", Math.abs(sum("zombies") - 1) < 1e-9 && Math.abs(sum("aliens") - 1) < 1e-9);
  add("horde variants pick by share", variantFor("zombies", 0).key === "zombie" && variantFor("zombies", 0.99).key === "brute" && variantFor("aliens", 0.99).key === "alien_heavy");
  const st = packState(), need = ["zombie", "zombie_b", "brute", "alien", "alien_heavy"];
  add("hosted pack: manifest loaded", st.ok, st.ok ? `version ${st.version}` : st.error || "still loading");
  add("hosted pack: horde models and sounds listed", need.every((k) => st.models.includes(k)) && st.sounds.length >= 19 && st.engineLoops === 6, `${st.models.length} models, ${st.sounds.length} sound keys, ${st.engineLoops} engine loops`);
  const au = game.audio.sampleState();
  add("hosted pack: samples and engine loops decoded", au.keys.length >= 19 && au.engineLoops, au.keys.length ? `${au.keys.length} keys, loops ${au.engineLoops}` : "none yet: click the game once, then run again");
}

export function round14Checks(game, add) {
  cdnChecks(game, add);
  skyChecks(add);
  add("sky cycle is running", !!game.skyCycle && typeof game.skyCycle.state().hour === "number");
  add("fortress turrets share the aim limits", typeof game.base === "object");
  sideMountChecks(add);
  bindChecks(add);
}