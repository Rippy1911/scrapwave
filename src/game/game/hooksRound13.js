// Round 13 test hooks (merged into window.scrapwake by game/hooks.js):
//   maps.list() / current() / save(map) / code(map) / fromCode(code) / layout(map) / play({ win, aiCount })
//   race.start("foundry" | "glowfield" | "brokeway" | "custom", { laps, ai }) / race.state()
//   photo(true | false) / photoState() / rideNet() / check13()
import { listMaps, currentMap, saveMap } from "@/game/arena/custom/store";
import { cleanMap, layoutOf, encodeMap, decodeMap } from "@/game/arena/custom/mapData";
import { DATA_MAPS } from "@/game/arena/custom/dataMaps";
import { packRide, readRide } from "@/game/net/rideNet";
import { findSites } from "@/game/arena/site";
import { setRules } from "@/game/rules/state";
import { SHOWCASE } from "@/game/workshop/showcase";
import { WING_IDS } from "@/game/workshop/wings";

const ARENA = { mode: "arena", fuel: false, building: false, raids: false, powerups: true };

export function round13Hooks(game) {
  const start = (patch) => { game.arena.start(setRules({ ...ARENA, ...patch })); game.emit({ type: "play" }); return game.arena.hud(); };
  return {
    maps: {
      list: () => listMaps().map((m) => ({ name: m.name, pieces: m.pieces.length })),
      current: () => currentMap(),
      save: (map) => saveMap(map),
      code: (map = currentMap()) => encodeMap(map),
      fromCode: (code) => decodeMap(code),
      layout: (map = currentMap()) => { const L = layoutOf(cleanMap(map)); return { spawns: L.spawns.length, checkpoints: L.checkpoints.length, power: L.power.length, horde: L.horde.length, props: L.props.length }; },
      play: (o = {}) => start({ name: "Your map", map: "custom", win: o.win || "any", aiCount: o.aiCount ?? 4, timeLimit: 300 }),
    },
    race: {
      start: (map = "foundry", o = {}) => start({ name: "Wreck Race", map, win: "race", laps: o.laps || 3, aiCount: o.ai ?? 5, timeLimit: 300 }),
      state: () => ({ ...game.arena.race.state(), arena: game.arena.active ? game.arena.map.name : null, over: game.arena.over }),
    },
    // Photo mode goes through the shell like the O key, so it only opens while playing.
    photo(on = true) { if (game.photo.active() !== !!on) game.emit({ type: "photo" }); return true; },
    photoState: () => ({ ...game.photo.state }),
    // What the other players are told about your ride (showcase number, wings).
    rideNet: () => readRide(packRide({ parts: [] }, game.player)),
    // Quick checks of the round's plain logic. Returns { ok, results: [[name, pass, detail]] }.
    check13() {
      const results = [], add = (name, pass, detail = "") => results.push([name, !!pass, detail]);
      add("pen site", !!findSites(game.world).pen);
      for (const id of ["foundry", "glowfield", "brokeway"]) {
        const raw = DATA_MAPS[id](), m = cleanMap(raw), L = layoutOf(m);
        add(`${id}: every piece kept`, m.pieces.length === raw.pieces.length, `${m.pieces.length}/${raw.pieces.length}`);
        add(`${id}: grid and rings`, L.spawns.length >= 10 && L.checkpoints.length >= 8, `${L.spawns.length} spots, ${L.checkpoints.length} rings`);
      }
      const empty = layoutOf(cleanMap({}));
      add("empty map is playable", empty.spawns.length === 10 && empty.checkpoints.length === 8);
      const m = cleanMap(DATA_MAPS.custom());
      add("map code round trip", JSON.stringify(decodeMap(encodeMap(m))) === JSON.stringify(m));
      add("bad map code refused", decodeMap("nonsense") === null);
      const r = readRide(packRide({ parts: ["hood"] }, { showcase: SHOWCASE[0].id, wings: [{ id: WING_IDS[0], tier: 2, side: "left" }, { id: WING_IDS[0], tier: 2, side: "right" }] }));
      add("ride over the net", r.show === 1 && r.wings === `${WING_IDS[0]}2l,${WING_IDS[0]}2r`, `${r.show} ${r.wings}`);
      add("plain car sends nothing", Array.isArray(packRide({ parts: [] }, { wings: null }).parts));
      return { ok: results.every((x) => x[1]), results };
    },
  };
}