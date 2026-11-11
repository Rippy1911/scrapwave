// Wire formats: the hello `paint` string also carries the fitted loadout (server allows [A-Za-z0-9_-]{1,24}),
// and an optional `~` suffix packs a compact emblem + title for nametags.
// and vehicle state packing for `s` / `ai` messages.
import * as THREE from "three";
import { encodeEmblemWire, decodeEmblemWire } from "@/game/fame/avatar";
import { titleLabel } from "@/game/fame/titles";

const TITLE_CODES = {};
let ti = 0;
for (const id of ["overall:1", "overall:2", "overall:3", "overall:4", "overall:5", "overall:6", "overall:7", "overall:8", "overall:9", "overall:10",
  "carnage:1", "carnage:5", "carnage:10", "speed:4", "speed:10", "stunts:6", "sky:8"]) {
  TITLE_CODES[id] = (ti++).toString(36);
}

const SLOTS = ["l1", "l2", "m1", "m2", "s1", "s2"];
const W2C = { mg: "m", scatter: "s", rockets: "r", harpoon: "h", flamer: "f", autocannon: "a", cannon: "c" };
const C2W = Object.fromEntries(Object.entries(W2C).map(([k, c]) => [c, k]));
const A2C = { scrap: "s", plate: "p", forged: "f" };
const C2A = Object.fromEntries(Object.entries(A2C).map(([k, c]) => [c, k]));

// "c7762e_00r0mm11p" = colour _ six slot codes, ram flag, armour tier.
export function encodePaint(paint, loadout = {}, armour = null, profile = null) {
  const hex = String(paint || "#c7762e").replace("#", "").slice(0, 6);
  const slots = SLOTS.map((s) => W2C[loadout[s]] || "0").join("");
  let out = `${hex}_${slots}${loadout.ram ? 1 : 0}${A2C[armour] || 0}`;
  if (profile?.avatar) {
    const em = encodeEmblemWire(profile.avatar);
    const tc = TITLE_CODES[profile.equippedTitle] || "0";
    const suf = `~${em}${tc}`;
    if (out.length + suf.length <= 24) out += suf;
  }
  return out.slice(0, 24);
}

const titleFromCode = (c) => {
  const hit = Object.entries(TITLE_CODES).find(([, v]) => v === c);
  return hit ? titleLabel(hit[0]) : "";
};

export function decodePaint(str) {
  const raw = String(str || "").split("~")[0];
  const prof = String(str || "").includes("~") ? String(str).split("~")[1] : "";
  const m = /^#?([0-9a-fA-F]{6})(?:_([0-9a-z]{6})([01])([0spf]))?$/.exec(raw);
  if (!m) return { paint: "#c7762e", loadout: null, armour: null, emblem: null, title: "" };
  const paint = "#" + m[1];
  const extra = { emblem: null, title: "" };
  if (prof && prof.length >= 4) {
    extra.emblem = decodeEmblemWire(prof.slice(0, 4));
    extra.title = prof.length > 4 ? titleFromCode(prof[4]) : "";
  }
  if (!m[2]) return { paint, loadout: null, armour: null, ...extra };
  const loadout = { ram: m[3] === "1" };
  SLOTS.forEach((s, i) => { const w = C2W[m[2][i]]; if (w) loadout[s] = w; });
  return { paint, loadout, armour: C2A[m[4]] || null, ...extra };
}

const d = new THREE.Vector3();
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

// flags: 1 alive, 2 firing, 4 rockets, 8 harpoon, 16 burning
export function packState(v) {
  d.subVectors(v.aimPoint, v.pos);
  const c = v.ctl, q = v.quat;
  return {
    x: r2(v.pos.x), y: r2(v.pos.y), z: r2(v.pos.z), qx: r4(q.x), qy: r4(q.y), qz: r4(q.z), qw: r4(q.w),
    vx: r2(v.vel.x), vy: r2(v.vel.y), vz: r2(v.vel.z), steer: r2(v.steer || 0), thr: r2(c.throttle || 0),
    turbo: v.turboActive ? 1 : 0, aimYaw: r2(Math.atan2(d.x, d.z)), aimPitch: r2(Math.atan2(d.y, Math.hypot(d.x, d.z))),
    hull: Math.max(0, Math.round(v.hull)),
    flags: (v.alive ? 1 : 0) | (c.fire ? 2 : 0) | (c.rockets ? 4 : 0) | (c.harpoon ? 8 : 0) | (v.burn > 0 ? 16 : 0),
    parts: v.mesh.parts.filter((p) => p.detached).map((p) => p.id),
  };
}

export function aimFrom(v, yaw, pitch) {
  const cp = Math.cos(pitch);
  v.aimPoint.set(v.pos.x + Math.sin(yaw) * cp * 60, v.pos.y + Math.sin(pitch) * 60, v.pos.z + Math.cos(yaw) * cp * 60);
}

// Damage zone of a world point on a vehicle, and the reverse (a point on the named zone).
const qi = new THREE.Quaternion(), l = new THREE.Vector3();
export function zoneOf(v, point) {
  qi.copy(v.quat).invert();
  l.copy(point).sub(v.pos).applyQuaternion(qi);
  const h = v.chassis.hit.half, c = v.chassis.hit.center;
  const rx = (l.x - c[0]) / h[0], ry = (l.y - c[1]) / h[1], rz = (l.z - c[2]) / h[2];
  const ax = Math.abs(rx), ay = Math.abs(ry), az = Math.abs(rz);
  if (ay > ax && ay > az && ry > 0) return "top";
  if (az >= ax) return rz < 0 ? "front" : "rear";
  return rx < 0 ? "left" : "right";
}
export function zonePoint(v, zone) {
  const h = v.chassis.hit.half, c = v.chassis.hit.center;
  const o = { front: [0, 0, -h[2]], rear: [0, 0, h[2]], left: [-h[0], 0, 0], right: [h[0], 0, 0], top: [0, h[1], 0] }[zone] || [0, 0, -h[2]];
  return new THREE.Vector3(c[0] + o[0] * 0.9, c[1] + o[1] * 0.9, c[2] + o[2] * 0.9).applyQuaternion(v.quat).add(v.pos);
}