// Two-window lobby check. ?lobbycheck=host: host a Derby lobby with a code, wait for a guest, change a rule,
// wait for ready, start, end the round, read the shared board, back to the lobby. ?lobbycheck=guest&code=X:
// join by code, see the rule change, ready up, play, see the board, back in the lobby. ?lobbycheck=link with a
// share link (?lobby=…): the page joins on its own and the check confirms it. Results go to an overlay
// (#lobby-check) together with the console errors seen during the run.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function overlay() {
  let el = document.getElementById("lobby-check");
  if (!el) {
    el = document.createElement("pre");
    el.id = "lobby-check";
    el.style.cssText = "position:fixed;left:8px;top:8px;z-index:99;max-width:46vw;background:rgba(0,0,0,.82);color:#cfe;font:11px/1.35 monospace;padding:8px;white-space:pre-wrap;pointer-events:none";
    document.body.appendChild(el);
  }
  return el;
}

async function until(fn, ms, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(step); }
  return null;
}

export async function runLobbyCheck(game, L, role = "host", opts = {}) {
  const el = overlay(), out = [];
  const errs = [], oErr = console.error;
  console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 160)); oErr(...a); };
  const onErr = (e) => errs.push(String(e.error?.stack || e.message).split("\n").slice(0, 2).join(" | "));
  window.addEventListener("error", onErr);
  const log = (ok, text) => { out.push(`${ok ? "✓" : "✗"} ${text}`); el.textContent = `LOBBY CHECK · ${role}\n${out.join("\n")}`; };
  const S = () => L.state(), lob = () => S().lobby;
  try {
    if (role === "host") {
      const h = await L.host("Derby", { name: "Check Derby", code: opts.code || "SCRAP7", max: 4 });
      log(h.ok, `host Derby · ${h.id} · code ${h.code} · shard ${S().shard}`);
      if (!h.ok) return out;
      log(true, `link ${L.link()}`);
      const two = await until(() => lob() && lob().players.filter((p) => !p.dropped).length >= 2, opts.waitGuest || 60000);
      log(!!two, `guest joined: ${two ? lob().players.map((p) => p.name).join(", ") : "nobody in time"}`);
      const rv = lob().rev;
      L.rules({ aiCount: 3 });
      log(lob().rev > rv && lob().rules.aiCount === 3, `rule changed: AI cars ${lob().rules.aiCount} (rev ${lob().rev})`);
      const ready = await until(() => !S().canStart, 30000);
      log(!!ready, `everyone ready (${S().canStart || "can start"})`);
      const st = L.start();
      log(st.ok && game.arena.active, `start: ${st.ok ? "match running" : st.reason} · arena ${game.arena.active ? game.arena.map.name : "off"} · AI ${game.arena.rules && game.arena.rules.aiCount}`);
      await sleep(opts.play || 5000);
      L.end();
      const res = await until(() => lob().phase === "results", 30000);
      log(!!res, `shared results: ${(lob().results || []).map((r) => `${r.name}${r.done ? "" : " (playing)"}`).join(", ")}`);
      const b = L.back();
      log(b.ok && lob().phase === "lobby" && !game.arena.active, "back to lobby, group kept: " + lob().players.length);
    } else if (role === "guest") {
      await L.browse();
      const j = await L.join(opts.code || "SCRAP7");
      log(j.ok, `join by code ${opts.code || "SCRAP7"}: ${j.ok ? j.id : j.reason}`);
      if (!j.ok) return out;
      const rv = lob().rev;
      const seen = await until(() => lob() && lob().rev > rv, 40000);
      log(!!seen, `rule change seen: AI cars ${lob() && lob().rules.aiCount}`);
      log(L.ready(true).ok, "ready");
      const m = await until(() => lob() && lob().phase === "match" && game.arena.active, 40000);
      log(!!m, `match started here: ${m ? game.arena.map.name : "no"}`);
      const res = await until(() => S().screen === "results" && lob().phase === "results", 50000);
      log(!!res, `shared results: ${(lob() && lob().results || []).map((r) => r.name).join(", ")}`);
      const back = await until(() => lob() && lob().phase === "lobby", 40000);
      log(!!back, "back in the lobby");
    } else {
      const j = await until(() => lob(), 30000);
      log(!!j, `joined from the link: ${j ? `${j.name} (${j.players.length} players)` : "no"}`);
    }
  } finally {
    await sleep(500);
    log(errs.length === 0, `console errors: ${errs.length}${errs.length ? "\n  " + errs.slice(0, 4).join("\n  ") : ""}`);
    console.error = oErr;
    window.removeEventListener("error", onErr);
  }
  return out;
}

// From the URL. Dev previews can boot the game twice; only the live hooks run it.
export function autoLobbyCheck(hooks) {
  const q = new URLSearchParams(window.location.search), role = q.get("lobbycheck");
  if (!role) return;
  setTimeout(() => { if (window.scrapwake && window.scrapwake.lobby === hooks) hooks.check(role, { code: q.get("code") || undefined }); }, 1500);
}