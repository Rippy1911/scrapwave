// Fame store in save.fame: six tracks, equipped title, tag, profile payload mirrors.

import { writeSave } from "@/game/core/save";
import {
  TRACKS,
  rankForPoints,
  unlockedTitleIds,
  overallRank,
  titleId,
  progressToNext,
  OVERALL_THRESHOLDS,
} from "@/game/fame/titles";
import { normalizeTag } from "@/game/fame/tagFilter";
import { clampAvatar, ensureAvatar } from "@/game/fame/avatar";

export const FAME_GAIN = {
  wreck: 12,
  wreckAir: 18,
  wreckWarlord: 45,
  bountyJob: 28,
  raceFinish: 35,
  racePodium1: 55,
  racePodium2: 40,
  racePodium3: 28,
  lapRecord: 42,
  airSecond: 2,
  flip: 10,
  bigAir: 16,
  hordeClear: 50,
  hordeNight: 38,
  cycleEnd: 22,
  ashamarkEpoch: 18,
  bankChunk: 8,
  workshopBuild: 24,
  upgradeBought: 16,
  skyKill: 15,
  skyFlight10s: 6,
  jobDone: 6,
};

export function ensureFame(save) {
  if (!save.fame || typeof save.fame !== "object") save.fame = {};
  for (const t of TRACKS) if (typeof save.fame[t.id] !== "number") save.fame[t.id] = 0;
  if (!save.profile || typeof save.profile !== "object") save.profile = {};
  if (!save.profile.equippedTitle) save.profile.equippedTitle = titleId("overall", 1);
  save.profile.tag = normalizeTag(save.profile.tag);
  ensureAvatar(save);
  return save.fame;
}

export function totalFame(fame) {
  return TRACKS.reduce((s, t) => s + (fame[t.id] || 0), 0);
}

export function fameView(save) {
  const fame = ensureFame(save);
  const unlocked = unlockedTitleIds(fame);
  const overall = overallRank(fame);
  const tracks = TRACKS.map((t) => ({
    ...t,
    points: fame[t.id] || 0,
    rank: rankForPoints(fame[t.id] || 0),
    ...progressToNext(fame[t.id] || 0),
  }));
  return {
    fame: { ...fame },
    total: totalFame(fame),
    overall,
    overallProgress: progressToNext(totalFame(fame), OVERALL_THRESHOLDS),
    tracks,
    unlocked,
    equippedTitle: save.profile.equippedTitle,
    tag: save.profile.tag || "",
    avatar: clampAvatar(save),
  };
}

export function addFame(game, track, amount, _reason = "") {
  if (!amount || game.noSave || game.demo?.running) return null;
  const fame = ensureFame(game.save);
  if (!TRACKS.some((t) => t.id === track)) return null;
  const beforeRank = rankForPoints(fame[track]);
  const beforeOverall = overallRank(fame);
  fame[track] = Math.max(0, Math.round((fame[track] || 0) + amount));
  const afterRank = rankForPoints(fame[track]);
  const afterOverall = overallRank(fame);
  const rankUps = [];
  if (afterRank > beforeRank) {
    for (let r = beforeRank + 1; r <= afterRank; r++) rankUps.push({ kind: "track", track, rank: r });
  }
  if (afterOverall > beforeOverall) {
    for (let r = beforeOverall + 1; r <= afterOverall; r++) rankUps.push({ kind: "overall", rank: r });
  }
  if (rankUps.length) {
    game.fame?.onRankUp?.(rankUps);
    game.fame?.scheduleCloudSave?.();
  } else if (amount >= 20) game.fame?.scheduleCloudSave?.();
  writeSave(game.save);
  return { track, amount, rankUps };
}

export function setEquippedTitle(save, id, unlocked) {
  const list = unlocked || unlockedTitleIds(ensureFame(save));
  if (!list.includes(id)) return false;
  save.profile.equippedTitle = id;
  return true;
}
