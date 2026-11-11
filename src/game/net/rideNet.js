// What you drive, for the other players (round 13). Rides alongside the walker state in `parts` (object form, numbers
// and booleans only, see net/mechNet.js and docs/protocol.md), so the room server needs no change:
//   ws        showcase vehicle, 1-based place in the SHOWCASE list (Cinderwing, Thornback, ...)
//   w0..w3    one wing each: wing id index * 100 + tier * 10 + side (0 left, 1 right, 2 roof)
// A wing that is shot off travels as its detached part id (wing_left, wing_right, wing_roof, fin) like any other part.
import { WING_IDS } from "@/game/workshop/wings";
import { SHOWCASE, showcaseDesign } from "@/game/workshop/showcase";

const SIDES = ["left", "right", "roof"], LETTER = { left: "l", right: "r", roof: "t" };

// Adds the ride to a packed state (after packMech). Returns the state.
export function packRide(state, v) {
  const show = v.showcase ? SHOWCASE.findIndex((s) => s.id === v.showcase) + 1 : 0;
  const wings = (v.wings || []).slice(0, 4);
  if (!show && !wings.length) return state;
  const parts = Array.isArray(state.parts) || !state.parts ? Object.fromEntries((state.parts || []).map((id) => [id, true])) : state.parts;
  if (Object.keys(parts).length + wings.length + 1 > 64) return state; // the server keeps 64 values at most
  if (show) parts.ws = show;
  wings.forEach((w, i) => { parts["w" + i] = WING_IDS.indexOf(w.id) * 100 + w.tier * 10 + Math.max(0, SIDES.indexOf(w.side)); });
  state.parts = parts;
  return state;
}

// { show, wings } from a remote state: the showcase number (0 = none) and the wings in packed text ("swept2l,swept2r").
export function readRide(s) {
  const p = s && s.parts, list = [];
  if (!p || Array.isArray(p)) return { show: 0, wings: "" };
  for (let i = 0; i < 4 && "w" + i in p; i++) {
    const n = +p["w" + i] || 0, id = WING_IDS[Math.floor(n / 100)], tier = Math.floor(n / 10) % 10, side = SIDES[n % 10];
    if (id && side && tier >= 1 && tier <= 3) list.push(`${id}${tier}${LETTER[side]}`);
  }
  return { show: Math.max(0, Math.round(+p.ws || 0)), wings: list.join(",") };
}

export const rideKey = (r) => `${r.show}|${r.wings}`;
export const showDesign = (n) => (SHOWCASE[n - 1] ? showcaseDesign(SHOWCASE[n - 1].id) : null);