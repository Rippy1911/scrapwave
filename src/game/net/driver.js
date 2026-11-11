// Driver name (shown to other players) and the hello payload built from the garage save.
import { encodePaint } from "@/game/net/codec";
import { local } from "@/game/core/safeStorage";

const KEY = "scrapwake.driverName";

export const getDriverName = () => local.get(KEY) || "";
export const setDriverName = (n) => { local.set(KEY, n); };
export const cleanName = (n) => String(n || "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 16);

export function helloFor(save, name) {
  const g = save.garage, ch = g.chassis, lo = g.loadouts[ch] || {};
  const profile = save.profile ? { avatar: save.profile.avatar, equippedTitle: save.profile.equippedTitle } : null;
  return { name: name || "Driver", vehicle: ch, paint: encodePaint(g.paint, { ...lo, ram: !!(lo.ram && g.owned.ram) }, g.armour[ch], profile) };
}