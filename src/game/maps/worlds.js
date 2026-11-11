// Registers the round 15 world maps with the catalog and the rules' map list. Imported by the map loader and the
// map picker, so the maps exist before any menu or match asks for them.
import { addMap } from "@/game/maps/catalog";
import { MAPS } from "@/game/rules/gameRules";
import { DERBY_BOWL } from "@/game/maps/arenas/derbyBowl";
import { CONTAINER_PORT } from "@/game/maps/arenas/containerPort";
import { QUARRY_PIT } from "@/game/maps/arenas/quarryPit";
import { CRATER_TOWN } from "@/game/maps/arenas/craterTown";
import { BRASSWATER_CITY } from "@/game/maps/arenas/brasswaterCity";

import { FOUNDRY_PEN } from "@/game/maps/race/foundryPen";
import { GLOWFIELD } from "@/game/maps/race/glowfield";
import { BROKEWAY } from "@/game/maps/race/brokeway";
import { RIDGEBACK_PASS } from "@/game/maps/race/ridgeback";
import { ASHMARK, ASHMARK_ONLINE } from "@/game/maps/ashmark/maps";

export const WORLD_MAPS = [DERBY_BOWL, CONTAINER_PORT, QUARRY_PIT, CRATER_TOWN, FOUNDRY_PEN, GLOWFIELD, BROKEWAY, RIDGEBACK_PASS, BRASSWATER_CITY];
for (const m of WORLD_MAPS) { addMap(m); MAPS[m.id] = m.name; }
// The Ashmark Expanse: free-roam maps, so they stay out of the rules' arena map list.
addMap(ASHMARK); addMap(ASHMARK_ONLINE);
