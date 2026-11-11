// Rules <-> a short URL parameter: ?rules=<base64url JSON>. Only fields that differ from DEFAULT_RULES are sent.
import { DEFAULT_RULES, validateRules } from "@/game/rules/gameRules";

const toB64Url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))));

export function encodeRules(rules) {
  const r = validateRules(rules), diff = { v: r.v };
  for (const k in r) if (k !== "v" && JSON.stringify(r[k]) !== JSON.stringify(DEFAULT_RULES[k])) diff[k] = r[k];
  return toB64Url(JSON.stringify(diff));
}

// Returns validated rules, or null for a missing or broken parameter.
export function decodeRules(param) {
  if (!param) return null;
  try { return validateRules(JSON.parse(fromB64Url(String(param)))); } catch { return null; }
}

export function shareUrl(rules) {
  const u = new URL(window.location.href);
  for (const k of ["rules", "mode", "map"]) u.searchParams.delete(k);
  u.searchParams.set("rules", encodeRules(rules));
  return u.toString();
}