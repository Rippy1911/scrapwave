// World messages from the net (the room server online, the loopback net offline) applied to bases,
// crates, jobs and the cycle. Offline answers carry no HP, stash or siphon amounts: those are computed here.
import { net } from "@/game/net/net";
import { BASE } from "@/game/data/tuning";
import { moduleDef, RIG } from "@/game/base/modules";

export function createWorldHandlers(game) {
  const base = game.base, { plots, modules } = base;
  const me = () => game.selfId();
  const online = () => net.mode === "online";
  const feed = (text) => game.emit({ type: "minor", text });

  function labelRig(plot) {
    const rig = modules.list.find((e) => e.plot === plot.id && e.kind === "rig");
    if (rig) modules.setStashLabel(rig, plot.stash, plot.owner && plot.owner.name, plot.dark);
  }
  base.labelRig = labelRig;

  function claim(m) {
    const owner = base.ownerFor(m.by, m.name, m.ai);
    const plot = plots.setOwner(m.plot, owner);
    if (!plot) return;
    base.claimed.add(m.by);
    modules.clearPlot(plot.id, "now");
    modules.spawn(plot, { ...RIG, ...(m.rig || {}), module: "rig" }, true);
    labelRig(plot);
    game.audio.clank?.();
    if (owner.me) {
      base.wallet.plot = plot.id;
      game.session.claimedAt = game.time;
      game.callout("PLOT CLAIMED", `${plot.name} · press B to build`, "#7fe0a0");
      game.emit({ type: "radio", from: "Well-town radio", text: `${plot.name} is yours. Build walls before the Rattlers smell it.` });
      game.audio.radio();
    } else feed(`${owner.name.toUpperCase()} CLAIMED ${plot.name.toUpperCase()}`);
  }

  function build(m) {
    const plot = plots.byId[m.plot], mod = m.mod;
    if (!plot || !plot.owner || !mod || modules.find(plot.id, mod.id)) return;
    const def = moduleDef(mod.module);
    modules.spawn(plot, { ...mod, hp: mod.hp ?? def.hp, maxHp: mod.maxHp ?? def.hp }, true);
    if (m.by === me()) {
      if (!online()) base.payOffline(plot, def.cost);
      base.saveLayout();
      feed(`${def.name.toUpperCase()} BUILT`);
      labelRig(plot);
    }
  }

  function modHit(m) {
    const e = modules.find(m.plot, m.modId);
    if (!e || !e.alive) return;
    const hp = typeof m.hp === "number" ? m.hp : e.hp - (+m.dmg || 0);
    modules.setHp(e, hp);
    if (e.plotRef.owner && e.plotRef.owner.id === me() && m.by !== me()) base.alertMine(e.kind === "rig" ? "They're on the Rig! Get back here!" : "The base is under attack!", { x: e.wx, z: e.wz });
    if (!online() && hp <= 0) modDead({ plot: m.plot, modId: m.modId, module: e.kind, by: m.by });
  }

  function modDead(m) {
    const e = modules.find(m.plot, m.modId);
    if (!e || !e.alive) return;
    modules.collapse(e);
    const plot = e.plotRef, mine = plot.owner && plot.owner.id === me();
    if (e.kind !== "rig") { if (mine) feed(`${e.def.name.toUpperCase()} DESTROYED`); base.saveLayout(); return; }
    if (!online()) {
      const spill = Math.floor(plot.stash * 0.4);
      plot.stash -= spill;
      for (let i = 0; i < 4 && spill > 0; i++) base.spawnCrate(e.wx + (Math.random() - 0.5) * 8, e.wy + 1, e.wz + (Math.random() - 0.5) * 8, spill / 4);
    }
    plots.setDark(plot.id);
    labelRig(plot);
    if (mine) {
      game.session.longestHold = Math.max(game.session.longestHold || 0, game.time - (game.session.claimedAt || game.time));
      game.session.claimedAt = null;
      game.callout("YOUR RIG IS DOWN", "the base is dark until the next cycle", "#ff4a2a");
      base.alertMine("The Rig is gone. Stash spilled.", { x: e.wx, z: e.wz });
    } else if (m.by === me()) { game.callout("RIG DESTROYED", `${plot.owner ? plot.owner.name : "?"}'s stash spilled`, "#f2c230"); game.session.moments.push({ score: 80, text: `Brought down ${plot.owner ? plot.owner.name : "a"}'s Rig` }); }
    else feed(`${(plot.owner ? plot.owner.name : "A").toUpperCase()}'S BASE WENT DARK`);
  }

  function siphon(m) {
    const plot = plots.byId[m.plot];
    if (!plot) return;
    let amount = +m.amount || 0;
    if (!online()) { amount = Math.floor(plot.stash * BASE.siphonShare); plot.stash -= amount; } else if (typeof m.stash === "number") plot.stash = m.stash;
    labelRig(plot);
    if (m.by === me()) {
      game.player.scrap += amount;
      game.session.siphons = (game.session.siphons || 0) + 1;
      game.callout("SIPHONED", `+${amount} scrap · bank it`, "#f2c230");
      game.session.moments.push({ score: 40 + amount / 20, text: `Siphoned ${amount} from ${plot.owner ? plot.owner.name : "a Rig"}` });
    } else {
      base.raids.onSiphoned(m.by, amount);
      if (plot.owner && plot.owner.id === me()) base.alertMine(`Raiders siphoned ${amount} scrap! Wreck them to get it back.`);
    }
  }

  function wallet(m) {
    if (m.ai) { base.aiWallets[m.ai] = m; return; }
    const spent = (base.wallet.bank || 0) - (m.bank || 0);
    if (spent > 0) game.save.banked = Math.max(0, game.save.banked - spent); // builds paid from the cycle bank
    base.wallet = { bank: m.bank | 0, banked: m.banked | 0, plot: m.plot || null, stash: m.stash | 0 };
    const p = base.mine();
    if (p && typeof m.stash === "number") { p.stash = m.stash; labelRig(p); }
  }

  function resync(w) {
    for (const p of plots.list) { modules.clearPlot(p.id, "now"); plots.setOwner(p.id, null); }
    base.claimed.clear();
    for (const sp of (w && w.plots) || []) {
      const plot = plots.setOwner(sp.id, base.ownerFor(sp.owner, sp.ownerName, sp.ai));
      if (!plot) continue;
      base.claimed.add(sp.owner);
      plot.stash = sp.stash | 0;
      const mods = sp.modules || [];
      if (!mods.some((x) => x.module === "rig") && !sp.dark) modules.spawn(plot, RIG, false);
      for (const md of mods) if (!(md.hp <= 0)) modules.spawn(plot, md, false);
      if (sp.dark) plots.setDark(plot.id);
      labelRig(plot);
    }
    for (const c of (w && w.crates) || []) base.addCrate(c);
    if (game.jobs) game.jobs.sync((w && w.jobs) || []);
  }

  function onWorld(m) {
    switch (m.t) {
      case "claim": return claim(m);
      case "build": return build(m);
      case "modHit": return modHit(m);
      case "modDead": return modDead(m);
      case "siphon": return siphon(m);
      case "wallet": return wallet(m);
      case "stash": for (const [id, n] of Object.entries(m.plots || {})) { const p = plots.byId[id]; if (p) { p.stash = n; labelRig(p); } } return undefined;
      case "no": if (m.what !== "build" || !m.ai) base.no(m.reason, m); return undefined;
      case "spawnCrate": return base.addCrate(m);
      case "crateGone": return base.removeCrate(m.id);
      case "lootOk": {
        game.player.scrap += m.scrap | 0;
        game.audio.pickup();
        return feed(`+${m.scrap | 0} SCRAP${m.part ? " · PART SALVAGED" : ""}`);
      }
      case "plotFree": { modules.clearPlot(m.plot); plots.setOwner(m.plot, null); return undefined; }
      case "job": return game.jobs && game.jobs.onNet(m);
      case "cycle": return game.cycleSys && game.cycleSys.sync(m.cycle, m.phase);
      case "cycleEnd": return game.cycleSys && game.cycleSys.serverEnd(m);
      case "welcome":
        if (game.cycleSys) game.cycleSys.sync(m.cycle);
        resync(m.world);
        if (m.wallet) { base.wallet = { ...m.wallet }; }
        return undefined;
      default: return undefined;
    }
  }

  function onEvent(m) {
    if (m.from && m.from === me()) return;
    if (m.kind === "loot") base.removeCrate(m.crateId);
    else if (m.kind === "turret") base.turrets.remoteShot(m);
    else if (base.pieceNet && m.kind && m.kind.startsWith("pc")) base.pieceNet.onEvent(m);
  }

  return { onWorld, onEvent, resync };
}