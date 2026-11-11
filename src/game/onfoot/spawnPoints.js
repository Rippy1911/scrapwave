// Spawn points are the safe zones you have visited (the Well-town always counts). Visits are remembered in
// save.rides.visited; your base plot counts while you hold one and have been there this session.
const rides = (save) => save.rides || (save.rides = { wrecked: {} });

export function createSpawnPoints(game, zones) {
  const visited = () => rides(game.save).visited || (rides(game.save).visited = ["town"]);

  return {
    // Remember the zone (x, z) is in. Called a couple of times a second with the player's position.
    visit(x, z) {
      const zone = zones.at(x, z);
      if (!zone) return null;
      const v = visited();
      if (!v.includes(zone.id)) { v.push(zone.id); game.emit({ type: "minor", text: `NEW SPAWN POINT · ${zone.name.toUpperCase()}` }); }
      return zone;
    },
    list() {
      const v = visited();
      return zones.all().filter((z) => z.kind === "town" || v.includes(z.id)).map((z) => ({ id: z.id, name: z.name, kind: z.kind }));
    },
    get(id) {
      const pts = this.list();
      return zones.byId((pts.find((p) => p.id === id) || pts[0]).id);
    },
  };
}