// Which screens stop the world. Single player: every menu pauses. Online (round 11): the room never stops, so the
// pause menu, garage and workshop, trader, map, spawn screen and results all leave the world running; the car sits
// idle while one is open (uiOpen), and only a safe zone protects it.
const LIVE = new Set(["playing", "build", "demo"]);
const MENUS = new Set(["paused", "garage", "trader", "map", "spawn", "results", "lobby", "photo"]);

export const isMenu = (phase) => MENUS.has(phase);

// true = the simulation should pause for this phase.
export function menuFreezes(phase, online) {
  if (LIVE.has(phase)) return false;
  if (online && MENUS.has(phase)) return false;
  return true;
}