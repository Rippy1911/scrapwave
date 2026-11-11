// Who counts as admin: the Base44 app's admin user (role "admin", set by the React shell after login) or a local
// developer flag from window.scrapwake.admin(true), stored only in this browser. Everything admin checks isAdmin().
import { local } from "@/game/core/safeStorage";
const KEY = "scrapwake.admin";
let roleAdmin = false;
const subs = new Set();

function devFlag() {
  return local.get(KEY) === "1";
}

export const isAdmin = () => roleAdmin || devFlag();
const notify = () => { for (const f of subs) f(isAdmin()); };

export function setRoleAdmin(on) { roleAdmin = !!on; notify(); }

export function setDevAdmin(on) {
  if (on) local.set(KEY, "1"); else local.remove(KEY);
  notify();
  return isAdmin();
}

export function onAdminChange(fn) { subs.add(fn); return () => subs.delete(fn); }