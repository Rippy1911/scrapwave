// Progress the save already tracks, read for tier unlocks: completed jobs + contracts and lifetime banked scrap.
// save.stats.jobsDone is counted by the workshop (it watches the JOB DONE / CONTRACT DONE callouts); older saves
// start it from today's finished contracts.
import { STORY } from "@/game/data/tuning";

export function progressOf(save) {
  const s = (save && save.stats) || {};
  const today = (save && save.contracts && save.contracts.done && save.contracts.done.length) || 0;
  const jobs = Math.max(s.jobsDone || 0, today);
  const banked = s.banked || 0;
  return { jobs, banked, story: Math.min(1, banked / STORY.banked) };
}

export function countJobDone(save) {
  if (!save || !save.stats) return;
  save.stats.jobsDone = progressOf(save).jobs + 1;
}