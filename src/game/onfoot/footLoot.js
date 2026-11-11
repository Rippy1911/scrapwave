// The kit a dead walker drops: a bag on the ground holding everything they carried. Walking over it takes it back
// (onfoot/loadout.js take). A bag stays FOOT.lootLife seconds; at most four lie out, the oldest goes first.
import { FOOT } from "@/game/onfoot/footGear";

const REACH = 1.6, MAX = 4;

export function createFootLoot(game, fx) {
  const bags = [];
  const drop = (i) => { fx.remove(bags[i].mesh); bags.splice(i, 1); };
  const carries = (kit) => !!(kit.long || kit.side || (kit.grenade && kit.grenade.n) || (kit.c4 && kit.c4.n));

  return {
    // kit: what loadout.drop() returned. Empty hands leave no bag.
    add(pos, kit) {
      if (!carries(kit)) return null;
      if (bags.length >= MAX) drop(0);
      const y = game.world.groundAt(pos.x, pos.z, pos.y + 1), mesh = fx.spawn("bag");
      mesh.position.set(pos.x, y, pos.z);
      const bag = { x: pos.x, y, z: pos.z, kit, until: game.time + FOOT.lootLife, mesh };
      bags.push(bag);
      return bag;
    },
    // The walker at pos picks up every bag in reach. Returns how many.
    collect(pos, loadout) {
      let n = 0;
      for (let i = bags.length - 1; i >= 0; i--) {
        const b = bags[i];
        if (game.time > b.until) { drop(i); continue; }
        if (Math.hypot(b.x - pos.x, b.z - pos.z) > REACH || Math.abs(b.y - pos.y) > 2) continue;
        loadout.take(b.kit);
        drop(i);
        n++;
      }
      return n;
    },
    frame(time) { for (const b of bags) b.mesh.rotation.y = time * 0.8; },
    list: () => bags.map((b) => ({ x: +b.x.toFixed(1), z: +b.z.toFixed(1), long: b.kit.long && b.kit.long.id, side: b.kit.side && b.kit.side.id, grenades: b.kit.grenade ? b.kit.grenade.n : 0, c4: b.kit.c4 ? b.kit.c4.n : 0 })),
    clear() { while (bags.length) drop(0); },
  };
}