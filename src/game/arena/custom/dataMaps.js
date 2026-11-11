// Arenas that are plain data and play in the pen (arena/custom/penMap.js), by rules map id.
import { currentMap } from "@/game/arena/custom/store";
import { FOUNDRY } from "@/game/arena/custom/tracks/foundry";
import { GLOWFIELD } from "@/game/arena/custom/tracks/glowfield";
import { BROKEWAY } from "@/game/arena/custom/tracks/brokeway";

export const DATA_MAPS = {
  foundry: () => FOUNDRY, // the three Wreck Race tracks
  glowfield: () => GLOWFIELD,
  brokeway: () => BROKEWAY,
  custom: () => currentMap(), // the map you saved or picked last in the map builder
};