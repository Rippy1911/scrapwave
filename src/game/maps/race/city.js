// City blocks for a race world: street walls (buildings facing the road on both sides, zone by zone), a grid of
// background blocks behind them, and street lamps. Nothing is put on the road, on a keep-out circle or into another
// building. Works on a race layout (maps/race/raceLayout.js); the result is plain data in L.blds and L.bits.
import { BLD, gapTo, clash } from "@/game/maps/race/buildings";

const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

/** keep: [{ x, z, r }] circles no building may touch (alleys, yards, landmarks). */
export function createCity(B, { keep = [], seed = 1 } = {}) {
  const S = B.samples, L = B.L;
  let n = seed * 100;
  function fits(b, margin) {
    for (const p of S) {
      if (Math.abs(p.x - b.x) > 90 || Math.abs(p.z - b.z) > 90) continue;
      if (gapTo(b, p.x, p.z) < p.w / 2 + margin) return false;
    }
    for (const k of keep) if (gapTo(b, k.x, k.z) < k.r) return false;
    for (const o of L.blds) if (Math.abs(o.x - b.x) < 80 && Math.abs(o.z - b.z) < 80 && clash(b, o, 1.5)) return false;
    return true;
  }
  /** Put a building if it fits: margin metres clear of the road's edge. Returns it or null. */
  function tryBld(t, x, z, r = 0, margin = 3, y = 0) {
    const [w, h, d] = BLD[t], b = { t, x, z, y, r, c: Math.floor(hash(++n, 3) * 5), w, h, d };
    if (!fits(b, margin)) return null;
    L.blds.push(b);
    return b;
  }

  return {
    tryBld,
    /** Buildings along the road in a zone. sides: { l, r }: template names for each side, or null for none. */
    street(zone, sides, setback = 4) {
      for (const [key, sd] of [["l", -1], ["r", 1]]) {
        const list = sides[key];
        if (!list) continue;
        let at = 0, next = 0;
        B.zone(zone, 4, (p, side) => {
          at += 4;
          if (at < next) return;
          const t = list[Math.floor(hash(++n, 1) * list.length)], [w, , d] = BLD[t], [x, z] = side(sd * (p.w / 2 + setback + d / 2));
          next = at + (tryBld(t, x, z, p.r + Math.PI / 2) ? w + 2 + hash(n, 2) * 5 : 8);
        });
      }
    },
    /** Background blocks on a grid over [x0, z0, x1, z1]. pick(x, z, h): a template name or null (h: 0..1 dice). */
    fill([x0, z0, x1, z1], pitch, pick, y = 0) {
      for (let x = x0; x <= x1; x += pitch) for (let z = z0; z <= z1; z += pitch) {
        const t = pick(x, z, hash(++n, 4));
        if (t) tryBld(t, x + (hash(n, 5) - 0.5) * 6, z + (hash(n, 6) - 0.5) * 6, hash(n, 7) < 0.5 ? 0 : Math.PI / 2, 9, y);
      }
    },
    /** Street lamps every `every` metres, on alternate sides: a pole, an arm over the road and a lit head. */
    lamps(zone, every = 44, lit = "lit:#ffd29a") {
      let k = 0;
      B.zone(zone, every, (p, side) => {
        const sd = k++ % 2 ? 1 : -1, [x, z] = side(sd * (p.w / 2 + 1.6)), [ax, az] = side(sd * (p.w / 2 + 0.2));
        B.bit("dark", x, p.y + 4, z, 0.3, 8, 0.3);
        B.bit("dark", ax, p.y + 7.9, az, 3, 0.2, 0.2, p.r);
        B.bit(lit, side(sd * (p.w / 2 - 1.2))[0], p.y + 7.75, side(sd * (p.w / 2 - 1.2))[1], 1.3, 0.22, 0.6, p.r);
      });
    },
  };
}