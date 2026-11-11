import { writeSave } from "@/game/core/save";
import { attachFameEvents } from "@/game/fame/fameEvents";
import { createProfileSync } from "@/game/fame/profileSync";
import { ensureFame, addFame, FAME_GAIN, fameView, setEquippedTitle } from "@/game/fame/fame";
import { titleLabel, titleId, TOP_OVERALL_TITLE } from "@/game/fame/titles";
import { attachNametagProfile } from "@/game/vehicles/nametagProfile";

export function createFame(game, { isAuthed = () => false } = {}) {
  ensureFame(game.save);
  const events = attachFameEvents(game);
  events.bindAirLanded();

  const sync = createProfileSync(game, isAuthed);
  const queue = [];

  const fame = {
    view: () => fameView(game.save),
    add(track, n) { return addFame(game, track, n); },
    scheduleCloudSave: () => sync.schedule(),
    onTrapUpgrade() {
      if (!game.autopilot) addFame(game, "salvage", FAME_GAIN.upgradeBought);
    },
    onRankUp(rankUps) {
      for (const u of rankUps) {
        const title = u.kind === "overall" ? titleId("overall", u.rank) : titleId(u.track, u.rank);
        const label = titleLabel(title);
        queue.push({ title, label, kind: u.kind, rank: u.rank, track: u.track });
        game.emit({ type: "rankUp", title, label, top: label === TOP_OVERALL_TITLE, track: u.track });
      }
    },
    popRankUp() { return queue.shift() || null; },
    equipTitle(id) {
      const ok = setEquippedTitle(game.save, id, fameView(game.save).unlocked);
      if (ok) {
        writeSave(game.save);
        sync.schedule();
        attachNametagProfile(game, game.player);
      }
      return ok;
    },
    setTag(tag) {
      game.save.profile.tag = tag;
      writeSave(game.save);
      sync.schedule();
      attachNametagProfile(game, game.player);
    },
    setAvatar(patch) {
      Object.assign(game.save.profile.avatar, patch);
      writeSave(game.save);
      sync.schedule();
      attachNametagProfile(game, game.player);
    },
    pullCloud: () => sync.pull(),
    flushCloud: (force) => sync.flush(force),
    step(dt) {
      events.step(dt);
    },
  };

  game.fame = fame;
  sync.pull().then(() => { if (game.player?.tag) attachNametagProfile(game, game.player); });
  return fame;
}
