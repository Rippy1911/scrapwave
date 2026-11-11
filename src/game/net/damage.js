// Damage routing. Vehicles this browser owns take damage directly; remote vehicles get `hit` events
// (aggregated per target/weapon every 200 ms and split under the server's per-weapon cap).
import { damageVehicle } from "@/game/vehicles/vehicle";
import CONFIG from "@/game/net/world-config.json";
import { zoneOf } from "@/game/net/codec";

const CAPS = CONFIG.weapons;

export function applyDamage(game, v, amount, point, attacker, o = {}) {
  if (game.cosmetic) return; // replaying someone else's shot or explosion: visuals only
  if (game.ruleSys) amount *= game.ruleSys.dmgMul(v, attacker); // rules: damage scale, armour boost, friendly fire
  if (!v.remote) return damageVehicle(game, v, amount, point, attacker, o);
  if (!v.alive || amount <= 0 || (attacker && game.inSafeZone(v))) return;
  game.netSync.queueHit(v, amount, o.weapon || "explosion", point, attacker);
  if (attacker === game.player) game.onHitMarker(v, amount);
}

// Run fn with damage switched off (effects of shots, wrecks and explosions owned by another browser).
export function cosmetic(game, fn) {
  const was = game.cosmetic;
  game.cosmetic = true;
  try { return fn(); } finally { game.cosmetic = was; }
}

export function createHitQueue(game, send, nid) {
  const q = new Map();
  let t = 0;
  return {
    add(v, amount, weapon, point, attacker) {
      const src = attacker && attacker !== game.player && !attacker.remote ? nid(attacker) : null;
      const key = `${v.netId}|${weapon}|${src || ""}`;
      let h = q.get(key);
      if (!h) q.set(key, (h = { target: v.netId, weapon, src, dmg: 0, zone: "front" }));
      h.dmg += amount;
      h.zone = zoneOf(v, point);
    },
    step(dt) {
      t -= dt;
      if (t > 0) return;
      t = 0.2;
      for (const h of q.values()) {
        const cap = (CAPS[h.weapon] || { maxHit: 25 }).maxHit;
        let left = h.dmg, n = 0;
        while (left > 0.5 && n++ < 6) {
          const dmg = Math.min(cap, left);
          left -= dmg;
          send({ target: h.target, dmg: Math.round(dmg * 10) / 10, weapon: h.weapon, zone: h.zone, ...(h.src ? { src: h.src } : {}) });
        }
      }
      q.clear();
    },
  };
}