// ?famecheck=1 — fame ranks, titles, tag filter, save round-trip, server validation stub.

import { loadSave, writeSave } from "@/game/core/save";
import {
  TRACKS, TRACK_THRESHOLDS, OVERALL_THRESHOLDS, TOP_OVERALL_TITLE,
  titleId, titleLabel, rankForPoints, unlockedTitleIds, overallRank, RANK_COUNT,
  allTitleIds,
} from "@/game/fame/titles";
import { addFame, ensureFame, FAME_GAIN } from "@/game/fame/fame";
import { normalizeTag, tagOk } from "@/game/fame/tagFilter";
import { validateFameUpdate, FAME_HOUR_CAP } from "@/game/fame/validate";

const SYNTH = [
  ["carnage", FAME_GAIN.wreck],
  ["speed", FAME_GAIN.racePodium1],
  ["stunts", FAME_GAIN.bigAir],
  ["survival", FAME_GAIN.cycleEnd],
  ["salvage", FAME_GAIN.workshopBuild],
  ["sky", FAME_GAIN.skyKill],
];

export function runFameCheck(game) {
  const out = [];
  const ok = (name, pass, detail = "") => out.push({ name, ok: !!pass, detail });

  const snap = JSON.stringify(game.save);
  ensureFame(game.save);
  for (const t of TRACKS) game.save.fame[t.id] = 1400;
  const wasNoSave = game.noSave;
  game.noSave = false;
  for (const [track, amt] of SYNTH) addFame(game, track, amt);
  game.noSave = wasNoSave;

  for (const t of TRACKS) {
    const pts = game.save.fame[t.id];
    const r = rankForPoints(pts);
    ok(`${t.id} rank thresholds`, r === RANK_COUNT, `points ${pts}, rank ${r}`);
    const title = titleLabel(titleId(t.id, RANK_COUNT));
    ok(`${t.id} top title unlocked`, unlockedTitleIds(game.save.fame).includes(titleId(t.id, RANK_COUNT)), title);
  }

  const total = TRACKS.reduce((s, t) => s + game.save.fame[t.id], 0);
  const or = overallRank(game.save.fame);
  ok("overall top rank", or === RANK_COUNT && total >= OVERALL_THRESHOLDS[RANK_COUNT - 1], `rank ${or}, total ${total}`);
  ok("Post-Apocalyptic Overlord only at top", titleLabel(titleId("overall", RANK_COUNT)) === TOP_OVERALL_TITLE,
    `overall:9=${titleLabel(titleId("overall", 9))}, overall:10=${titleLabel(titleId("overall", RANK_COUNT))}`);
  ok("overlord not at rank 9", titleLabel(titleId("overall", 9)) !== TOP_OVERALL_TITLE, titleLabel(titleId("overall", 9)));

  ok("tag blocks profanity", !normalizeTag("fuck"), "filtered empty");
  ok("tag allows clean", tagOk("Salt Ghost"), normalizeTag("Salt Ghost"));
  ok("tag max 14", tagOk("123456789012345") === false, normalizeTag("123456789012345").length <= 14);

  writeSave(game.save);
  const loaded = loadSave();
  ok("save round-trip fame", JSON.stringify(loaded.fame) === JSON.stringify(game.save.fame), JSON.stringify(loaded.fame));

  const drop = validateFameUpdate({ carnage: 100 }, { carnage: 90 });
  ok("server stub rejects drop", !drop.ok && drop.reason === "fame_carnage_dropped", drop.reason);

  const jump = validateFameUpdate({ carnage: 0 }, { carnage: FAME_HOUR_CAP + 50 }, { t: Date.now(), gained: 0 });
  ok("server stub rejects hour jump", !jump.ok && jump.reason === "fame_hour_cap", jump.reason);

  const titleCount = allTitleIds().length;
  ok("title table size", titleCount === 70, `${titleCount} titles`);

  console.log("[famecheck] results:");
  for (const r of out) console.log(`  ${r.ok ? "OK" : "NO"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  const pass = out.every((r) => r.ok);
  console.log(`[famecheck] ${pass ? "PASS" : "FAIL"} ${out.filter((x) => x.ok).length}/${out.length}`);
  Object.assign(game.save, JSON.parse(snap));
  game.fameReport = { ok: pass, rows: out, titles: TRACKS.map((t) => ({
    track: t.name,
    ranks: TRACK_THRESHOLDS.map((th, i) => ({ rank: i + 1, need: th, title: titleLabel(titleId(t.id, i + 1)) })),
  })), overall: OVERALL_THRESHOLDS.map((th, i) => ({ rank: i + 1, need: th, title: titleLabel(titleId("overall", i + 1)) })) };
  return game.fameReport;
}

export function installFameCheck(game) {
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  if (q?.get("famecheck") === "1") setTimeout(() => runFameCheck(game), 2500);
}
