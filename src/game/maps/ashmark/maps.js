// The Ashmark Expanse in the map catalog (maps/worlds.js registers both): a free-roam world, solo or online.
// It has no build(): it is not laid out on a deck like the arena and race worlds, it streams (bigWorld.js).
// The roam map picker calls wantRoam(id) just before it starts play; the big world takes it at session start.
import { drawAshmark } from "@/game/maps/ashmark/layout";

const base = { kind: "roam", big: true, size: [10000, 10000], draw: drawAshmark };
export const ASHMARK = { ...base, id: "ashmark", name: "The Ashmark Expanse", blurb: "Ten kilometres a side: a ruined city, the Spine's peaks and pass, a dune sea and drowned lowlands round the open flats. Solo." };
export const ASHMARK_ONLINE = { ...base, id: "ashmark-online", online: true, name: "The Ashmark Expanse · Online", blurb: "The same ten kilometres of city, mountains, dunes and marsh, with every driver on the road." };

export const isBigMap = (id) => id === ASHMARK.id || id === ASHMARK_ONLINE.id;

let wanted = null;
export const wantRoam = (id) => { wanted = id || null; };
export const peekRoam = () => wanted;
export const takeRoam = () => { const id = wanted; wanted = null; return id; };