// window.scrapwake.onfoot and .spawnMenu — round 9 test hooks (safe zones, on foot, free cars, Choose your ride).
export function footHooks(game) {
  const f = () => game.onfoot;
  const car = (v) => v && { id: v.id, name: v.stats.name, free: !!v.free, empty: !!v.empty, summoned: !!v.summoned, x: +v.pos.x.toFixed(1), z: +v.pos.z.toFixed(1) };
  return {
    // onfoot.state(); exit() (stopped, in a zone); enter(id?) gets into a car (default: the nearest enterable);
    // zones(); landmarks(); free() → free cars; parked(); summon() opens the summon list; teleport(x, z) moves
    // the walker; remote(id, { x, y, z, h } | { gone: 1 }) fakes another player on foot.
    onfoot: {
      state: () => f().state(),
      hud: () => f().hud(),
      exit: () => f().exit(),
      enter(id) {
        const v = id != null ? game.vehicles.find((x) => x.id === id) : null;
        if (v) return car(f().enter(v));
        return f().active() ? car(f().enter(game.player)) : null;
      },
      zones: () => f().zones.list().map((z) => ({ id: z.id, kind: z.kind, name: z.name, x: Math.round(z.x), z: Math.round(z.z), r: z.r })),
      landmarks: () => f().landmarks.map((m) => ({ id: m.id, kind: m.kind, x: +m.x.toFixed(1), z: +m.z.toFixed(1) })),
      free: () => game.vehicles.filter((v) => v.free).map(car),
      parked: () => car(f().rides.parked()),
      summon: () => f().summon(),
      teleport(x, z) { const w = f().walker; w.place(x, game.world.groundAt(x, z, 999), z, w.heading); return f().state(); },
      remote: (id, d) => { f().remote.apply(String(id), { s: 0, ...d }); return f().remote.count(); },
      safeAt: (x, z) => game.weaponsSafeAt(x, z),
    },
    // foot.state() → { onFoot, health, slots, ammo, aiming, scope, down, dead, charges, loot, shots };
    // foot.give(id, tier) puts sniper | rpg | sidearm | grenade | c4 at Tier 1 to 3 in the hands and selects it.
    foot: {
      state: () => f().foot(),
      give: (id, tier = 1) => (f().combat.give(id, tier) ? f().foot() : false),
    },
    // spawnMenu.open(reason?) / options(zoneId?) / choose(zoneId, "free" | "free:<id>" | chassis, { repair }) / close().
    spawnMenu: {
      open: (reason = "wreck") => f().spawn.open(reason),
      options: (zoneId) => f().spawn.options(zoneId),
      choose: (zoneId, vehicle, o) => f().spawn.choose(zoneId, vehicle, o),
      close: () => f().spawn.close(),
      isOpen: () => f().spawn.isOpen(),
    },
  };
}