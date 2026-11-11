import { titleLabel } from "@/game/fame/titles";
import { redrawNameTag } from "@/game/vehicles/nametag";

export function profileSub(save) {
  if (!save?.profile) return "";
  const parts = [];
  if (save.profile.equippedTitle) parts.push(titleLabel(save.profile.equippedTitle));
  if (save.profile.tag) parts.push(save.profile.tag);
  return parts.join(" · ");
}

export function attachNametagProfile(game, v) {
  if (!v?.tag) return;
  const sub = profileSub(game.save);
  const avatar = game.save?.profile?.avatar;
  redrawNameTag(v, { sub, avatar });
}

export function remoteProfileSub(dec) {
  const parts = [];
  if (dec.title) parts.push(dec.title);
  return parts.join(" · ");
}

export function decodeRemoteProfile(dec) {
  return { avatar: dec.emblem, sub: remoteProfileSub(dec) };
}
