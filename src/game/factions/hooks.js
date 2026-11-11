// window.scrapwake.factions: rep(), set(faction, value), standing(faction), plus test helpers:
// prices(postId), board(faction), trader(postId), militia(), skirmish(faction) (guard + Rattlers at a border),
// fights() (guards currently fighting AI), walker(id, pose) (a remote scavenger, no second client needed),
// check() (factions/check.js). ?factioncheck=1 runs check() two seconds after load and shows the result.
import { runFactionCheck } from "@/game/factions/check";
import { FACTIONS } from "@/game/factions/roster";

export function installFactionHooks(game, api) {
  const F = () => game.factions;
  api.factions = {
    list: () => FACTIONS.map((f) => f.id),
    rep: () => Object.fromEntries(F().all().map((r) => [r.id, { value: r.value, standing: r.standing.name }])),
    set: (id, value) => { const r = F().rep.set(id, +value, "hook"); F().rep.step(1); return r ? F().rep.get(id) : null; },
    standing: (id) => (F().rep.byId[id] ? F().rep.standing(id).name : null),
    prices: (postId = "trader-town") => F().trader.view(postId).goods.map((g) => ({ id: g.id, buy: g.buy, sell: g.sell, needed: g.needed })),
    trader: (postId = "trader-town") => F().trader.view(postId),
    board: (id = "well") => game.jobs.board(id),
    take: (kind, id) => game.jobs.takeKind(kind, id),
    militia: () => F().militia.list(),
    skirmish: (id = "well") => F().militia.skirmish(id),
    fights: () => F().militia.fights(),
    walker: (id = "test-walker", pose) => { const p = pose || { x: game.player.pos.x + 4, y: game.player.pos.y, z: game.player.pos.z, h: 0 }; game.onfoot.remote.apply(id, p); return game.onfoot.remote.count(); },
    willAttack: (vehicleId) => { const v = game.vehicles.find((x) => x.id === vehicleId); return v ? F().willAttack(v, game.player) : null; },
    check: () => runFactionCheck(game),
  };

  if (new URLSearchParams(window.location.search).get("factioncheck") === "1") {
    const errs = [], oErr = console.error;
    window.addEventListener("error", (e) => errs.push(String(e.error?.stack || e.message).split("\n").slice(0, 3).join(" | ")));
    window.addEventListener("unhandledrejection", (e) => errs.push(String(e.reason)));
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 160)); oErr(...a); };
    // Dev previews can boot the game twice; only the live game's timers run.
    const setTimeout = (fn, ms) => window.setTimeout(() => { if (window.scrapwake === api) fn(); }, ms);
    setTimeout(() => {
      const t = document.getElementById("faction-check");
      if (t) t.textContent += `\nconsole errors after 20 s: ${errs.length}${errs.length ? "\n" + errs.slice(0, 5).join("\n") : ""}`;
      console.error = oErr;
    }, 20000);
    // With ?autoplay=1 too: open the map at 5 s and the town Trader menu at 30 s so both screens render in the run.
    setTimeout(() => game.emit({ type: "map" }), 5000);
    setTimeout(() => { game.emit({ type: "map" }); game.emit({ type: "trader", id: "trader-town", tab: "trade" }); }, 30000);
    setTimeout(() => {
      const r = runFactionCheck(game);
      console.info("[factions] check", r);
      const el = document.createElement("pre");
      el.id = "faction-check";
      el.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;max-width:70vw;white-space:pre-wrap;font:12px monospace;background:rgba(0,0,0,.85);color:#e6dfcc;padding:10px;border:1px solid #f2c230";
      el.textContent = `FACTION CHECK ${r.ok ? "PASS" : "FAIL"}\n` + r.results.map((x) => `${x.ok ? "ok  " : "FAIL"} ${x.name} · ${x.detail}`).join("\n");
      document.body.appendChild(el);
    }, 2000);
  }
}