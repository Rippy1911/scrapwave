// Emblem editor data (no uploads). Unlocks follow fame rank via unlockTier().

import { unlockTier } from "@/game/fame/titles";

export const SHAPES = [
  { id: "circle", min: 1, label: "Circle" },
  { id: "shield", min: 2, label: "Shield" },
  { id: "hex", min: 3, label: "Hex" },
  { id: "diamond", min: 4, label: "Diamond" },
  { id: "star", min: 6, label: "Star" },
  { id: "oct", min: 8, label: "Octagon" },
];

export const BORDERS = [
  { id: "none", min: 1, label: "None" },
  { id: "thin", min: 2, label: "Thin" },
  { id: "dash", min: 4, label: "Dashed" },
  { id: "double", min: 6, label: "Double" },
  { id: "barbed", min: 8, label: "Barbed" },
  { id: "crown", min: 10, label: "Crown" },
];

// 24 original icons (SVG paths drawn in emblemDraw.js).
export const ICONS = [
  { id: 0, min: 1, name: "Bolt" },
  { id: 1, min: 1, name: "Gear" },
  { id: 2, min: 1, name: "Skull" },
  { id: 3, min: 2, name: "Wheel" },
  { id: 4, min: 2, name: "Wrench" },
  { id: 5, min: 3, name: "Flame" },
  { id: 6, min: 3, name: "Wing" },
  { id: 7, min: 4, name: "Crosshair" },
  { id: 8, min: 4, name: "Ram" },
  { id: 9, min: 5, name: "Turret" },
  { id: 10, min: 5, name: "Spike" },
  { id: 11, min: 5, name: "Crate" },
  { id: 12, min: 6, name: "Radio" },
  { id: 13, min: 6, name: "Fuel" },
  { id: 14, min: 7, name: "Horns" },
  { id: 15, min: 7, name: "Dust" },
  { id: 16, min: 7, name: "Bridge" },
  { id: 17, min: 8, name: "Storm" },
  { id: 18, min: 8, name: "Pickaxe" },
  { id: 19, min: 9, name: "Satellite" },
  { id: 20, min: 9, name: "Harpoon" },
  { id: 21, min: 9, name: "Ramp" },
  { id: 22, min: 10, name: "Crown" },
  { id: 23, min: 10, name: "Sunrise" },
];

export const DEFAULT_AVATAR = {
  shape: "circle",
  icon: 0,
  color: "#c7762e",
  color2: "#3a3734",
  border: "thin",
  walker: null,
};

export function ensureAvatar(save) {
  if (!save.profile || typeof save.profile !== "object") save.profile = {};
  if (!save.profile.avatar || typeof save.profile.avatar !== "object") save.profile.avatar = { ...DEFAULT_AVATAR };
  const a = save.profile.avatar;
  if (!save.profile.walker) save.profile.walker = null;
  a.walker = a.walker ?? save.profile.walker ?? null;
  return a;
}

export function clampAvatar(save) {
  const a = ensureAvatar(save);
  const tier = unlockTier(save.fame || {});
  const shape = SHAPES.find((s) => s.id === a.shape);
  const border = BORDERS.find((b) => b.id === a.border);
  const icon = ICONS.find((i) => i.id === a.icon);
  if (!shape || shape.min > tier) a.shape = "circle";
  if (!border || border.min > tier) a.border = "none";
  if (!icon || icon.min > tier) a.icon = 0;
  a.color = String(a.color || DEFAULT_AVATAR.color).slice(0, 7);
  a.color2 = String(a.color2 || DEFAULT_AVATAR.color2).slice(0, 7);
  return a;
}

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function enc2(n) {
  return B36[n % 36] + B36[Math.floor(n / 36) % 36];
}

export function encodeEmblemWire(avatar) {
  const si = Math.max(0, SHAPES.findIndex((s) => s.id === avatar.shape));
  const bi = Math.max(0, BORDERS.findIndex((b) => b.id === avatar.border));
  const icon = Math.max(0, Math.min(23, avatar.icon | 0));
  return `${si}${enc2(icon)}${bi}`.slice(0, 4);
}

export function decodeEmblemWire(code) {
  const s = String(code || "").toLowerCase();
  if (s.length < 4) return null;
  const shape = SHAPES[parseInt(s[0], 10)]?.id || "circle";
  const icon = B36.indexOf(s[1]) + B36.indexOf(s[2]) * 36;
  const border = BORDERS[parseInt(s[3], 10)]?.id || "none";
  return { ...DEFAULT_AVATAR, shape, icon: Math.max(0, Math.min(23, icon)), border };
}
