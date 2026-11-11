// Validate and clamp the free-build section of a design (saved, imported or from a hook). Unknown part types are
// dropped, tiers clamp to I-III, positions clamp to the build volume, limbs must hang on a real joint (no loops),
// weapons must fit their mount, one Transform Core at most. A design without free parts has no `free` key, so
// older blueprints and today's cars compile exactly as before.
import { FREE_PARTS, JOINT_ROLES, isJoint, freeWeaponsFor } from "@/game/workshop/freeParts";
import { clampTier } from "@/game/workshop/tiers";

export const FREE_VERSION = 1;
export const HARD_CAP = 300; // never more than this, whatever the quality
export const BOUNDS = { x: [-6, 6], y: [-3, 8], z: [-8, 8] };
// The part cap keeps the frame rate: 300 parts on the High preset, 150 otherwise.
export const partCap = (quality) => (quality === "high" || quality === "ultra" ? HARD_CAP : 150);

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const deg = (v) => { let a = num(v) % 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return Math.round(a * 10) / 10; };
const vec = (p) => { const a = Array.isArray(p) ? p : []; return [r3(clamp(num(a[0]), ...BOUNDS.x)), r3(clamp(num(a[1]), ...BOUNDS.y)), r3(clamp(num(a[2]), ...BOUNDS.z))]; };
const rot = (r) => { const a = Array.isArray(r) ? r : []; return [deg(a[0]), deg(a[1]), deg(a[2])]; };
const cleanPose = (n) => String(n ?? "").replace(/[^\w \-']/g, "").trim().slice(0, 16);

function cleanPart(x) {
  if (!x || typeof x !== "object" || !FREE_PARTS[x.t]) return null;
  const out = { id: Math.max(1, Math.round(num(x.id, 0))), t: x.t, tier: clampTier(x.tier), p: vec(x.p), r: rot(x.r) };
  if (x.w && typeof x.w === "object") out.w = { p: vec(x.w.p), r: rot(x.w.r) };
  if (x.limb) out.limb = Math.round(num(x.limb));
  if (x.mir) out.mir = Math.round(num(x.mir));
  if (isJoint(x.t)) {
    const d = FREE_PARTS[x.t];
    if (JOINT_ROLES.includes(x.role) && x.role) out.role = x.role;
    const k = Math.round(num(x.key));
    if (k >= 1 && k <= 9) out.key = k;
    if (x.pose) out.pose = cleanPose(x.pose);
    const lo = clamp(num(x.min, d.range[0]), d.range[0], d.range[1]), hi = clamp(num(x.max, d.range[1]), d.range[0], d.range[1]);
    out.min = r3(Math.min(lo, hi)); out.max = r3(Math.max(lo, hi));
    if (x.t === "rotor" || x.t === "motor") { if (x.spin) out.spin = true; }
  }
  if (FREE_PARTS[x.t].mount && x.wpn && freeWeaponsFor(x.t).includes(x.wpn.id)) out.wpn = { id: x.wpn.id, tier: clampTier(x.wpn.tier) };
  return out;
}

// Returns a clean free section, or null when there is nothing in it.
export function normalizeFree(raw) {
  if (!raw || typeof raw !== "object") return null;
  const seen = new Set(), parts = [];
  let core = false;
  for (const x of (Array.isArray(raw.parts) ? raw.parts : []).slice(0, HARD_CAP)) {
    const p = cleanPart(x);
    if (!p || seen.has(p.id)) continue;
    if (FREE_PARTS[p.t].unique) { if (core) continue; core = true; }
    seen.add(p.id); parts.push(p);
  }
  const byId = new Map(parts.map((p) => [p.id, p]));
  for (const p of parts) {
    if (p.limb && !(byId.has(p.limb) && isJoint(byId.get(p.limb).t) && p.limb !== p.id)) delete p.limb;
    if (p.mir && !byId.has(p.mir)) delete p.mir;
  }
  // No loops in the limb chains (a joint hung on its own child).
  for (const p of parts) {
    let q = p, n = 0;
    while (q && q.limb && n < 40) { q = byId.get(q.limb); n++; if (q === p) { delete p.limb; break; } }
    if (n >= 40) delete p.limb;
  }
  const poses = (Array.isArray(raw.poses) ? raw.poses : []).slice(0, 9).map((s) => {
    if (!s || typeof s !== "object") return null;
    const values = {};
    for (const [k, v] of Object.entries(s.values || {})) if (byId.has(+k) && isJoint(byId.get(+k).t)) values[+k] = r3(clamp(num(v), -6.3, 6.3));
    const key = Math.round(num(s.key));
    return { name: cleanPose(s.name) || "Pose", key: key >= 1 && key <= 9 ? key : 0, values };
  }).filter(Boolean);
  if (!parts.length && !poses.length) return null;
  const next = Math.max(num(raw.next, 1), ...parts.map((p) => p.id + 1), 1);
  return { v: FREE_VERSION, parts, poses, next };
}

export const freeCount = (design) => design?.free?.parts?.length || 0;
export const hasCore = (design) => !!design?.free?.parts?.some((p) => FREE_PARTS[p.t].core);