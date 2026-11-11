// Fire groups (round 14): every weapon mount answers to one trigger. By default guns fire on LMB / J, rockets on
// F / K and the harpoon on E, as before; the Loadout screen (pause menu) can move any mount to another trigger or
// switch it off. Choices are kept in save.binds by mount id (s1, m3, sl, sr ...). AI cars never have a choice set.
export const GROUPS = {
  guns: { name: "Guns", keys: "LMB · J" },
  heavy: { name: "Heavy", keys: "F · K" },
  aux: { name: "Utility", keys: "E" },
  off: { name: "Off", keys: "safe" },
};
export const GROUP_IDS = Object.keys(GROUPS);

export const defaultGroup = (kind) => (kind === "rocket" ? "heavy" : kind === "harpoon" ? "aux" : "guns");
export const groupOf = (w) => w.group || defaultGroup(w.def.kind);
export const mountIdOf = (w) => (w.mount && w.mount.hp ? w.mount.hp.id : null);

// Copy the saved choices onto the car's weapons (cheap: run every step for the player's car).
export function bindWeapons(save, v) {
  const b = save && save.binds;
  for (const w of v.weapons) {
    const g = b ? b[mountIdOf(w)] : null;
    w.group = GROUPS[g] ? g : undefined;
  }
}

// Set one mount's trigger. Choosing the weapon's default clears the entry.
export function setBind(save, w, group) {
  const id = mountIdOf(w);
  if (!id || !GROUPS[group]) return false;
  const next = { ...(save.binds || {}) };
  if (group === defaultGroup(w.def.kind)) delete next[id]; else next[id] = group;
  save.binds = next;
  return true;
}

// "Left side", "Right side" or "Mount S1" for the Loadout screen.
export function mountLabel(w) {
  const hp = w.mount && w.mount.hp;
  if (!hp) return "Mount";
  return hp.side ? `${hp.side === "left" ? "Left" : "Right"} side` : `Mount ${String(hp.id).toUpperCase()}`;
}