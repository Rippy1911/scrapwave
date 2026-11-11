// No weapons fire inside a safe zone, by anyone: every car this browser simulates has its fire controls cleared
// (and any rocket salvo in progress cancelled) while its centre is inside a zone. Runs after every controller
// (player, AI, arena, traps) and before combat reads the controls. Base turrets ask game.weaponsSafeAt(x, z).
// Remote cars are gated by their own browser, whose shots we only replay.
export function createWeaponsGate(game, zones) {
  game.weaponsSafeAt = (x, z) => !!zones.at(x, z);

  return {
    step() {
      for (const v of game.vehicles) {
        if (v.remote) continue;
        const zone = zones.at(v.pos.x, v.pos.z);
        v.safeZone = zone;
        if (!zone) continue;
        const c = v.ctl;
        c.fire = false; c.rockets = false; c.harpoon = false;
        for (const w of v.weapons) if (w.salvo > 0) w.salvo = 0;
      }
    },
  };
}