// The active rules (one per page) plus your own saved presets in localStorage.
import { DEFAULT_RULES, validateRules } from "@/game/rules/gameRules";
import { PRESETS, presetPatch } from "@/game/rules/presets";
import { local } from "@/game/core/safeStorage";

const KEY = "scrapwake-presets-v1";
let active = validateRules(DEFAULT_RULES);
const listeners = new Set();

export const getRules = () => active;
export function setRules(next) {
  active = validateRules(next);
  for (const fn of listeners) fn(active);
  return active;
}
export const patchRules = (patch) => setRules({ ...active, ...patch });
export const onRules = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function loadCustom() {
  try {
    const list = local.getJSON(KEY, []);
    return Array.isArray(list) ? list.map((r) => validateRules(r)) : [];
  } catch { return []; }
}
export function saveCustom(rules) {
  const r = validateRules(rules);
  const list = loadCustom().filter((x) => x.name !== r.name);
  list.push(r);
  local.setJSON(KEY, list.slice(-20));
  return r;
}
export function deleteCustom(name) {
  local.setJSON(KEY, loadCustom().filter((x) => x.name !== name));
}

// A built-in preset or one of yours, by name (case-insensitive). Returns validated rules or null.
export function findPreset(name) {
  const p = presetPatch(name);
  if (p) return validateRules(p);
  const c = loadCustom().find((x) => x.name.toLowerCase() === String(name).toLowerCase());
  return c || null;
}
export const builtInNames = () => PRESETS.map((p) => p.name);