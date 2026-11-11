// The lobby's link to the room server: sends lobby messages (whole when this browser is the shard host, else as
// paced chat lines) and hands every incoming lobby message and join/leave/welcome to onMessage / onWorld.
import { net } from "@/game/net/net";
import { toLines, createAssembler, createChatQueue, isLobbyText } from "@/game/lobby/wire";

export function createTransport({ onMessage, onWorld, onHost }) {
  const asm = createAssembler();
  let impl = null, offs = [];
  const chat = createChatQueue((text) => (impl && net.mode === "online" ? impl.sendEvent("chat", { text }) : false));

  function onEvent(m) {
    if (!m || (m.from && m.from === net.myId())) return;
    if (m.kind === "chat" && isLobbyText(m.text)) {
      const msg = asm.feed(m.from, m.text);
      if (msg) onMessage({ ...msg, from: m.from, name: m.name });
    } else if (m.kind === "ai" && m.lobby && typeof m.lobby === "object") {
      const { type, lid, data } = m.lobby;
      if (typeof type === "string" && typeof lid === "string") onMessage({ type, lid, data, from: m.from });
    }
  }

  const T = {
    online: () => net.mode === "online",
    me: () => net.myId(),
    rtt: () => (impl ? Math.round(impl.rtt()) : 0),
    shard: () => (impl && impl.shard ? impl.shard() : null),
    shardHost: () => net.mode === "online" && net.isHost(),
    // Subscribe to the current online connection (again after net.goOnline swapped it).
    ensure() {
      const cur = net.mode === "online" ? net.impl() : null;
      if (cur === impl) return !!impl;
      for (const off of offs) off();
      offs = [];
      chat.clear();
      impl = cur;
      if (impl) offs = [impl.onEvent(onEvent), impl.onWorld((m) => onWorld(m)), impl.onHost((h) => onHost && onHost(h))];
      return !!impl;
    },
    // key: messages that supersede each other (a newer snapshot drops an unsent older one).
    send(type, lid, data, key = null) {
      if (!T.ensure()) return false;
      if (T.shardHost()) return impl.sendEvent("ai", { lobby: { type, lid, data } });
      chat.push(toLines(type, lid, data), key);
      return true;
    },
    pending: () => chat.size(),
    dispose() { for (const off of offs) off(); offs = []; impl = null; chat.dispose(); },
  };
  return T;
}