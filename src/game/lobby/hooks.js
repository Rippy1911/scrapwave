// window.scrapwake.lobby: host(rules, opts), list(), join(idOrCode, code), ready(on), start(), state(), plus
// ride(r), rules(patch), chat(text), end(), back(), leave(), link(). rules: a preset name, a rules object or
// nothing (the current rules). Async ones (host, join) resolve with { ok, reason?, id?, code? }.
import { getRules, findPreset } from "@/game/rules/state";
import { validateRules } from "@/game/rules/gameRules";
import { freeRide, garageRide } from "@/game/lobby/rideRules";
import { runLobbyCheck, autoLobbyCheck } from "@/game/lobby/check";

const rulesOf = (r) => (typeof r === "string" ? findPreset(r) : r && typeof r === "object" ? validateRules(r) : getRules());

export function lobbyHooks(game) {
  const L = () => game.lobby;
  const hooks = {
    host(rules, opts = {}) {
      const r = rulesOf(rules);
      if (!r) return Promise.resolve({ ok: false, reason: `No preset called ${rules}` });
      return L().host(r, opts);
    },
    list: () => L().list(),
    browse: () => L().browse(),
    join: (idOrCode, code = "", shard = null) => L().join(idOrCode, code, shard),
    ready: (on = true) => L().ready(on),
    start: () => L().start(),
    state: () => L().state(),
    // ride("brawler") = a free Brawler; ride("garage") = your garage car; or a ride object.
    ride(r) {
      const l = L().state().lobby;
      if (!l) return { ok: false, reason: "Not in a lobby" };
      const ride = r === "garage" ? garageRide(game.save, l.rules) : typeof r === "string" ? freeRide(r) : r;
      return L().ride(ride);
    },
    rules(patch = {}) { const l = L().state().lobby; return l ? L().setRules({ ...l.rules, ...patch }) : { ok: false, reason: "Not in a lobby" }; },
    chat: (t) => L().chat(t),
    end: () => L().endMatch(),
    back: () => L().back(),
    leave: () => L().leave(),
    link: () => L().link(),
    // The two-window check: ?lobbycheck=host (this window hosts) or ?lobbycheck=guest&code=… (joins by code).
    check: (role, opts) => runLobbyCheck(game, hooks, role, opts),
  };
  autoLobbyCheck(hooks);
  return hooks;
}