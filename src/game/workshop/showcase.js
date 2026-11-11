// Showcase vehicles (round 13): one ready-made, over-the-top design per type, free from the first minute, one copy
// of each. They cannot be sold. A wrecked one comes back after a short cooldown. Each is a built-in blueprint:
// "Edit a copy" opens it in the Workshop as your own design (the parts then cost as usual).
import { presetByName, copyDesign } from "@/game/workshop/designs";
import { normalizeDesign } from "@/game/workshop/validate";
import { compileDesign } from "@/game/workshop/compile";
import { wreckframeDesign } from "@/game/mech/wreckframe";
import { scuttlerDesign } from "@/game/mech/scuttler";

export const SHOWCASE_COOLDOWN = 45; // seconds before a wrecked showcase vehicle is back

const T = (id, tier = 1) => ({ id, tier });

function cinderwing() {
  const d = copyDesign(presetByName("Jackal"));
  d.name = "Cinderwing"; d.paint = "#c8321e";
  Object.assign(d.parts, { chassis: T("light", 3), cab: T("cage", 2), body: T("openbed"), engine: T("medium", 3), tyres: T("road", 2), turbo: T("big", 3), armourFront: T("plate", 1) });
  d.weapons = [T("mg", 2), T("mg", 2), T("rockets", 3)];
  d.wings = [{ id: "swept", tier: 3, side: "left" }, { id: "swept", tier: 3, side: "right" }, { id: "tailfin", tier: 3, side: "roof" }];
  return d;
}
function thornback() {
  const d = copyDesign(presetByName("Brawler"));
  d.name = "Thornback"; d.paint = "#4a3b33";
  Object.assign(d.parts, { chassis: T("heavy", 3), cab: T("armoured", 3), body: T("armoured", 2), engine: T("large", 3), tyres: T("spiked", 3), turbo: T("big", 2), ram: T("blade", 3), armourFront: T("plate", 3), armourSides: T("plate", 2), armourRear: T("plate", 2), armourRoof: T("plate", 1) });
  d.weapons = [T("scatter", 2), T("scatter", 2), T("flamer", 2), T("rockets", 2), T("autocannon", 2)];
  return d;
}
function doubleDealer() {
  const d = copyDesign(presetByName("Jackal"));
  d.name = "Double Dealer"; d.paint = "#d9b23a";
  Object.assign(d.parts, { chassis: T("light", 2), cab: T("cage", 3), body: T("openbed", 2), engine: T("small", 3), tyres: T("offroad", 3), turbo: T("big", 2) });
  d.weapons = [T("mg", 3), T("mg", 3), T("harpoon", 2)];
  return d;
}
function caltrop() {
  const d = copyDesign(presetByName("Chopper"));
  d.name = "Caltrop"; d.paint = "#7a1f1f";
  Object.assign(d.parts, { chassis: T("chopper", 3), engine: T("bike", 3), tyres: T("bike", 3), turret: T("tail", 3) });
  return d;
}

// perks: mines = the mine racks; traps = trap charges multiplier at roll-out.
export const SHOWCASE = [
  { id: "cinderwing", name: "Cinderwing", type: "Winged rocket car", blurb: "Hold turbo off any bump and it flies. W/S pitch, A/D bank.", make: cinderwing, perks: {} },
  { id: "thornback", name: "Thornback", type: "Spiked ram truck", blurb: "Forged ram, spiked tyres and mine racks. Goes through things.", make: thornback, perks: { mines: true, traps: 2 } },
  { id: "wreckframe", name: "Wreckframe", type: "Transforming walker", blurb: "T folds it between Drive and Walker. Shoulder rockets and a ram fist.", make: wreckframeDesign, perks: {} },
  { id: "doubledealer", name: "Double Dealer", type: "Twin-turret buggy", blurb: "Two Tier III gun turrets on a featherweight frame.", make: doubleDealer, perks: {} },
  { id: "caltrop", name: "Caltrop", type: "Trap-laying bike", blurb: "Triple trap charges. G drops, H cycles oil, spikes and mines.", make: caltrop, perks: { traps: 3 } },
  { id: "scuttler", name: "Scuttler", type: "Four-legged walker", blurb: "T stands it up on four legs. Sure-footed on any ground.", make: scuttlerDesign, perks: {} },
];
export const showcaseById = (id) => SHOWCASE.find((s) => s.id === String(id).replace(/^show:/, "").toLowerCase() || s.name.toLowerCase() === String(id).toLowerCase()) || null;

const cache = new Map();
// The built-in blueprint (normalized; treat as read-only).
export function showcaseDesign(id) {
  const s = showcaseById(id);
  if (!s) return null;
  if (!cache.has(s.id)) cache.set(s.id, normalizeDesign(s.make()));
  return cache.get(s.id);
}
// "Edit a copy": your own design to change in the Workshop.
export function showcaseCopy(id) {
  const d = showcaseDesign(id);
  if (!d) return null;
  const c = copyDesign(d);
  c.name = `${d.name} Mk II`;
  return normalizeDesign(c);
}

const book = (save) => save.showcase || (save.showcase = { wrecked: {} });
export function showcaseStatus(save, id, now = Date.now()) {
  const at = book(save).wrecked[id];
  if (!at) return { ready: true, wait: 0 };
  const wait = Math.max(0, Math.ceil(SHOWCASE_COOLDOWN - (now - at) / 1000));
  if (wait <= 0) { delete book(save).wrecked[id]; return { ready: true, wait: 0 }; }
  return { ready: false, wait };
}
export const markShowcaseWrecked = (save, id) => { book(save).wrecked[id] = Date.now(); };

// Rows for the "Choose your ride" screen and the garage.
export function showcaseList(save) {
  return SHOWCASE.map((s) => ({ ...rowOf(s), status: showcaseStatus(save, s.id) }));
}

const rows = new Map(); // compiled once: the designs never change
function rowOf(s) {
  if (rows.has(s.id)) return rows.get(s.id);
  const c = compileDesign(showcaseDesign(s.id)), sum = c.summary;
  const tags = [];
  if (sum.wings && sum.wings.canFly) tags.push("Flies on turbo");
  if (c.mech && c.mech.core) tags.push(`Walker · ${c.mech.legs} legs`);
  if (s.perks.mines) tags.push("Mine racks");
  if (s.perks.traps) tags.push(`Traps x${s.perks.traps}`);
  const row = { id: s.id, name: s.name, type: s.type, blurb: s.blurb, tags, hull: sum.hull, topSpeed: sum.topSpeed };
  rows.set(s.id, row);
  return row;
}