// localStorage and sessionStorage that never throw. Private mode, blocked site data, a full quota or a sandboxed
// frame make the real Storage throw; then the value lives in memory for this page instead, so the game keeps
// working and only loses it on reload. Keys and stored strings are exactly what the direct calls used.
//   local.get(key) / set(key, value) / remove(key) / getJSON(key, fallback) / setJSON(key, value), same on session.
//   storageOk(): false when localStorage cannot hold your progress on this device.

function area(name) {
  const mem = new Map(); // keys whose last write could not reach the real storage
  const real = () => window[name]; // reading the property itself throws when site data is blocked
  const api = {
    get(key) {
      if (mem.has(key)) return mem.get(key);
      try { return real().getItem(key); } catch { return null; }
    },
    set(key, value) {
      const v = String(value);
      try { real().setItem(key, v); mem.delete(key); return true; } catch { mem.set(key, v); return false; }
    },
    remove(key) {
      mem.delete(key);
      try { real().removeItem(key); } catch { /* blocked: the memory copy is gone, which is all there is */ }
    },
    getJSON(key, fallback = null) {
      const raw = api.get(key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    },
    setJSON(key, value) {
      let raw;
      try { raw = JSON.stringify(value); } catch { return false; }
      return api.set(key, raw);
    },
  };
  return api;
}

export const local = area("localStorage");
export const session = area("sessionStorage");

let ok = null;
export function storageOk() {
  if (ok !== null) return ok;
  try {
    const s = window.localStorage, k = "scrapwake.storageProbe";
    s.setItem(k, "1");
    ok = s.getItem(k) === "1";
    s.removeItem(k);
  } catch { ok = false; }
  return ok;
}
