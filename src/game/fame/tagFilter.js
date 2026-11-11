// Optional driver tag: letters, digits, spaces, max 14, small blocklist.

const BLOCK = new Set(["admin", "mod", "mods", "staff", "nazi", "hitler", "fuck", "shit", "ass", "rape", "nigger", "faggot"]);

export function normalizeTag(raw) {
  const s = String(raw || "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14);
  if (!s) return "";
  const low = s.toLowerCase();
  if (BLOCK.has(low)) return "";
  for (const w of BLOCK) {
    if (low.includes(w)) return "";
  }
  return s;
}

export function tagOk(raw) {
  const want = String(raw || "").trim();
  if (!want) return true;
  if (want.replace(/\s+/g, " ").trim().length > 14) return false;
  const got = normalizeTag(want);
  return got.length > 0 && got === want.replace(/\s+/g, " ").trim().slice(0, 14);
}
