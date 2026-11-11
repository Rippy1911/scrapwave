// Raider fortresses: three walled strongholds of the raider faction built from blueprints (fortressLayouts.js),
// with turrets on the towers and guard cars outside. Break in with rockets and rams, wreck the core for a big
// payout; the fortress rebuilds a few minutes later once nobody is close.
import { net } from "@/game/net/net";
import { fortLayout } from "@/game/base/fortressLayouts";
import { createFortTurrets } from "@/game/base/fortTurrets";
import { createFortGuards } from "@/game/base/fortGuards";
import { labelSprite, drawLabel } from "@/game/base/plots";
import { findFortSite } from "@/game/base/fortSites";

export const FORT_REWARD = 1200, FORT_BOUNTY = 400, FORT_REBUILD = 300, GUARDS = 3;
const SITES = [
  { id: "rustjaw", name: "Rustjaw Keep", x: -120, z: 480, style: "rustjaw" },
  { id: "cinder", name: "Cinder Hold", x: 520, z: -460, style: "cinder" },
  { id: "gutter", name: "Gutter Bastion", x: -520, z: -180, style: "gutter" },
];

export function createFortresses(game) {
  const base = game.base, pieces = base.pieces;
  const turrets = createFortTurrets(game), guards = createFortGuards(game);
  const forts = SITES.map((s) => ({ ...s, ...findFortSite(game, s), state: "standing", gen: 0, guards: [], rebuildAt: 0, falls: 0 }));
  const group = (f) => `fort:${f.id}`;
  const core = (f) => pieces.group(group(f)).find((p) => p.kind === "core" && p.alive) || null;

  function build(f) {
    pieces.clearGroup(group(f));
    f.gen++;
    fortLayout(f.style, f.q).forEach((d, i) => pieces.spawn(group(f), { ...d, id: `${group(f)}#${f.gen}-${i}` }, f, { rise: f.gen > 1, owner: "raiders" }));
    f.state = "standing";
    const c = core(f);
    if (!f.label) { f.label = labelSprite(); game.scene.add(f.label); }
    f.label.position.set(c.wx, c.top + 5, c.wz); f.label.visible = true;
    drawLabel(f.label, f.name.toUpperCase(), "RAIDER FORTRESS", "#ff5a3a");
    if (net.isHost() && !game.demo.running) {
      const room = GUARDS - f.guards.filter((v) => v.alive).length;
      if (room > 0) f.guards.push(...guards.spawn(f, room));
    }
  }

  pieces.onBreak((pc, by) => {
    if (pc.kind !== "core" || !pc.group.startsWith("fort:")) return;
    const f = forts.find((x) => group(x) === pc.group);
    if (!f || f.state !== "standing") return;
    f.state = "fallen"; f.falls++; f.rebuildAt = game.time + FORT_REBUILD;
    if (f.label) f.label.visible = false;
    game.combat.explode(pc.o.root.position.clone().setY(pc.y0 + 2), 9, 120, by || null, 1.6, null, "explosion");
    for (let i = 0; i < 6; i++) base.spawnCrate(pc.wx + (Math.random() - 0.5) * 10, pc.y0 + 1.5, pc.wz + (Math.random() - 0.5) * 10, FORT_REWARD / 6, i === 0);
    if (by === game.player) {
      game.player.scrap += FORT_BOUNTY;
      game.callout("FORTRESS FALLEN", `${f.name} · +${FORT_BOUNTY} bounty · loot the crates`, "#f2c230");
      game.session?.moments?.push({ score: 120, text: `Wrecked the core of ${f.name}` });
    } else game.emit({ type: "minor", text: `${f.name.toUpperCase()} HAS FALLEN` });
  });

  const near = (f, r) => game.vehicles.some((v) => v.alive && v.team !== "rattler" && v.team !== "warlord" && Math.hypot(v.pos.x - f.x, v.pos.z - f.z) < r);

  return {
    list: forts,
    start() { for (const f of forts) if (!pieces.group(group(f)).length) build(f); },
    build,
    core,
    step(dt) {
      for (const f of forts) if (f.state === "fallen" && game.time >= f.rebuildAt && !near(f, 160)) build(f);
      const tur = [];
      for (const f of forts) if (f.state === "standing") tur.push(...pieces.group(group(f)).filter((p) => p.kind === "turret"));
      turrets.step(dt, tur, net.isHost());
      if (net.isHost()) guards.step(dt, forts);
    },
    // Nearest fortress within 160 m for the HUD.
    hud() {
      const p = game.player;
      let best = null, bd = 160;
      for (const f of forts) { const d = Math.hypot(p.pos.x - f.x, p.pos.z - f.z); if (d < bd) { bd = d; best = f; } }
      if (!best) return null;
      const c = core(best), g = pieces.group(group(best));
      return { name: best.name, state: best.state, core: c ? c.hp / c.maxHp : 0, walls: g.filter((x) => x.kind === "wall" || x.kind === "gate").length, guards: best.guards.filter((v) => v.alive).length, rebuild: best.state === "fallen" ? Math.max(0, Math.round(best.rebuildAt - game.time)) : 0 };
    },
    state: () => forts.map((f) => {
      const c = core(f), g = pieces.group(group(f));
      return { id: f.id, name: f.name, x: Math.round(f.x), z: Math.round(f.z), state: f.state, pieces: g.length, core: c ? { id: c.id, hp: Math.round(c.hp), maxHp: c.maxHp } : null, turrets: g.filter((x) => x.kind === "turret").length, guards: f.guards.filter((v) => v.alive).length, falls: f.falls, rebuildIn: f.state === "fallen" ? Math.max(0, Math.round(f.rebuildAt - game.time)) : 0 };
    }),
    clear() { turrets.clear(); },
  };
}