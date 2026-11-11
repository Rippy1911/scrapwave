// Aircraft lane entry point: game.air (flight controller) and game.adminActions (admin panel actions).
import { createAirSystem } from "@/game/air/control";
import { adminActions } from "@/game/air/adminActions";

export function createAir(game) {
  game.air = createAirSystem(game);
  game.adminActions = adminActions(game);
  return game.air;
}

export { airHooks, adminHook } from "@/game/air/hooks";
export { isAdmin, setRoleAdmin, onAdminChange } from "@/game/air/admin";