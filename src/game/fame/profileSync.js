// Debounced cloud profile save (rank-up and profile edits).

import { writeSave } from "@/game/core/save";
import { saveProfile, loadProfile } from "@/lib/server-fns";
import { ensureFame } from "@/game/fame/fame";
import { clampAvatar, ensureAvatar } from "@/game/fame/avatar";
import { normalizeTag } from "@/game/fame/tagFilter";
import { mergeFameLocal } from "@/game/fame/validate";

const DEBOUNCE_MS = 4000;

export function createProfileSync(game, isAuthed) {
  let timer = null;
  let inflight = null;
  let hourBucket = { t: Date.now(), gained: 0 };
  let lastSaved = null;

  const payload = () => {
    ensureFame(game.save);
    clampAvatar(game.save);
    game.save.profile.tag = normalizeTag(game.save.profile.tag);
    return {
      fame: { ...game.save.fame },
      equipped_title: game.save.profile.equippedTitle || "overall:1",
      tag: game.save.profile.tag || "",
      avatar: { ...game.save.profile.avatar },
      fame_hour: hourBucket,
    };
  };

  const flush = async (force = false) => {
    if (!isAuthed() || game.noSave) return { skipped: "no_auth" };
    const body = payload();
    const now = Date.now();
    if (now - hourBucket.t > 3600000) hourBucket = { t: now, gained: 0 };
    if (!force && lastSaved && JSON.stringify(body.fame) === JSON.stringify(lastSaved.fame)
      && body.equipped_title === lastSaved.equipped_title && body.tag === lastSaved.tag
      && JSON.stringify(body.avatar) === JSON.stringify(lastSaved.avatar)) return { skipped: "unchanged" };
    if (inflight) return inflight;
    inflight = saveProfile({ data: body })
      .then((r) => {
        if (r?.hour) hourBucket = r.hour;
        lastSaved = body;
        return r;
      })
      .catch((e) => ({ ok: false, error: String(e.message || e) }))
      .finally(() => { inflight = null; });
    return inflight;
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => flush(true), DEBOUNCE_MS);
  };

  const pull = async () => {
    if (!isAuthed()) return null;
    try {
      const row = await loadProfile();
      if (!row?.fame) return null;
      game.save.fame = mergeFameLocal(game.save.fame, row.fame);
      if (row.equipped_title) game.save.profile.equippedTitle = row.equipped_title;
      if (row.tag != null) game.save.profile.tag = normalizeTag(row.tag);
      if (row.avatar) Object.assign(ensureAvatar(game.save), row.avatar);
      if (row.fame_hour) hourBucket = row.fame_hour;
      writeSave(game.save);
      return row;
    } catch {
      return null;
    }
  };

  return { schedule, flush, pull, hourBucket: () => hourBucket };
}
