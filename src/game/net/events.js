// Incoming relayed events (`ev`) and world messages (join/leave/resume).
import * as THREE from "three";
import { damageVehicle, detachPart, wreckVehicle } from "@/game/vehicles/vehicle";
import { cosmetic } from "@/game/net/damage";
import { zonePoint } from "@/game/net/codec";
import { showEmote } from "@/game/net/emotes";
import { isLobbyText } from "@/game/lobby/wire";

const SPLASH = new Set(["explosion", "rockets", "rocket", "mine", "flamer", "burn"]);

export function createEventHandlers(game, sync) {
  const { remotes } = sync;
  const myId = () => sync.myId();
  const byId = (id) => (id && id === myId() ? game.player : remotes.find(id));
  const feed = (text) => game.emit({ type: "minor", text });

  function onHit(m) {
    const target = sync.owned(m.target);
    if (!target || !target.alive) return;
    const from = remotes.find(m.src || m.from);
    damageVehicle(game, target, Math.max(0, +m.dmg || 0), zonePoint(target, m.zone), from, { splash: SPLASH.has(m.weapon) });
    if (from && target === game.player) from.hitMeT = 1.2; // threat arrow points at the shooter
  }

  function onEvent(m) {
    if (m.from && m.from === myId()) return;
    switch (m.kind) {
      case "hit": return onHit(m);
      case "partOff": {
        const v = remotes.find(m.vehicle);
        const part = v && v.alive && v.mesh.parts.find((p) => p.id === m.part && !p.detached);
        if (part) cosmetic(game, () => detachPart(game, v, part, m.by === myId() ? game.player : null));
        return;
      }
      case "wreck": {
        const v = remotes.find(m.vehicle), by = byId(m.by);
        const e = m.by && m.by !== myId() ? remotes.entry(m.by) : null;
        if (e && !e.ai) e.wrecks++;
        if (v && v.alive) cosmetic(game, () => wreckVehicle(game, v, by));
        if (v && v.team === "remote") feed(`${v.name} WRECKED${by ? " BY " + by.name : ""}`);
        return;
      }
      case "explode": {
        const p = new THREE.Vector3(+m.x || 0, +m.y || 0, +m.z || 0), s = Math.min(2, +m.scale || 1);
        game.particles.explosion(p.x, p.y, p.z, s);
        game.fx.flash(p.x, p.y + 1, p.z, 600 * s, 0.35);
        game.audio.explosion(p, s);
        game.shake(p, s);
        return;
      }
      case "chat": if (isLobbyText(m.text)) return undefined; // lobby traffic (lobby/wire.js), not for the chat box
        return game.emit({ type: "chat", name: m.name || remotes.name(m.from), text: String(m.text || "").slice(0, 120) });
      case "emote": return showEmote(game, remotes.find(m.from), m.id | 0);
      case "bank": {
        const e = remotes.entry(m.from);
        if (e) e.banked += m.scrap | 0;
        return feed(`${remotes.name(m.from)} BANKED ${m.scrap | 0}`);
      }
      default: return undefined;
    }
  }

  function onWorld(m) {
    if (m.t === "join" && m.player) {
      remotes.setInfo(m.player.id, m.player);
      sync.peers(+1);
      if (!m.resumed) feed(`${m.player.name} JOINED THE SALTREACH`);
    } else if (m.t === "leave") {
      feed(`${remotes.name(m.id)} LEFT`);
      remotes.remove(m.id);
      sync.peers(-1);
    } else if (m.t === "welcome") sync.resumed(m);
  }

  return { onEvent, onWorld };
}