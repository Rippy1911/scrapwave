// The Ashmark's road plan as plain data (map coordinates). roads.js turns it into sampled lines with heights.
//   kind: "highway" (the ring, 12 m of broken asphalt), "road" (8 m: the flats road, the pass, the sluiceway, the
//         rim road over the dam) or "track" (6 m of dirt to a point of interest)
//   pts: control points, smoothed unless straight (the pass and the sluiceway follow the lines the ground is cut to)
//   from / to: the road this one starts or ends on (its first or last point moves onto that road, at its height)
//   site: the place the road ends at (the last point is added at the edge of the site's pad)
//   grade: steepest slope allowed; the profile is eased until it fits
//   bridge: a level stretch `len` metres long centred at `at`, `lift` metres above the highest ground under it,
//           carried on a deck wherever the ground is lower; gap leaves that many metres in the middle open
import { PASS, GORGE } from "@/game/maps/ashmark/layout";

const xz = (P) => P.map((p) => [p[0], p[1]]);

export const ROAD_DEFS = [
  { id: "ring", kind: "highway", name: "The Ring", loop: true, grade: 0.09,
    pts: [[-500, -1250], [400, -1090], [1100, -1120], [2300, -1000], [3300, -500], [3600, 300], [3350, 1150], [2700, 2200], [1900, 3300],
      [700, 3750], [-800, 3620], [-1900, 3300], [-2700, 2400], [-3300, 1400], [-3150, 300], [-2600, -700], [-1600, -1130]],
    bridge: { at: [3480, -241], len: 190, lift: 3, gap: 18 } }, // crest to crest over a dune trough
  { id: "flats", kind: "road", name: "Flats Road", to: "ring", grade: 0.1, pts: [[0, -40], [-140, -520], [-430, -980], [-500, -1250]] },
  { id: "pass", kind: "road", name: "Spine Pass", straight: true, from: "ring", pts: xz(PASS) },
  { id: "gorge", kind: "road", name: "The Sluiceway", straight: true, from: "pass", to: "ring", pts: [...xz(GORGE), [3420, -900], [3060, -670]] },
  // The rim road leaves the head of the pass beside the sluiceway, so it starts on the sluiceway (joined roads share a bed).
  { id: "rim", kind: "road", name: "Rim Road", from: "gorge", to: "gorge", grade: 0.14,
    pts: [[-900, -3800], [-300, -3870], [500, -3790], [1050, -3680], [1423, -3592], [1377, -3408], [1657, -3326], [1901, -3266], [2155, -3236]],
    bridge: { at: [1400, -3500], len: 150, lift: 0 } },

  // The Spine
  { id: "t-climb", kind: "track", name: "Crown Climb", from: "pass", site: "mast", grade: 0.22,
    pts: [[-900, -3800], [-1250, -3600], [-1450, -3350], [-1420, -3050], [-1500, -2800], [-1300, -2720], [-1420, -2620], [-1230, -2580], [-1120, -2620]] },
  { id: "t-run", kind: "track", name: "The Long Fall", from: "t-climb", to: "ring", grade: 0.55,
    pts: [[-1020, -2520], [-1010, -2300], [-1000, -2050], [-1000, -1800], [-1020, -1550], [-1100, -1300], [-1150, -1170]] },
  { id: "t-launch", kind: "track", name: "Kestrel Spur", from: "t-run", site: "launch", grade: 0.2, pts: [[-1000, -2080], [-955, -2086]] },
  { id: "t-gspine", kind: "track", name: "Passfoot", from: "pass", site: "g-spine", pts: [[-508, -1560]] },

  // Old Varrow
  { id: "t-tower", kind: "track", name: "Halcyon Way", from: "ring", site: "tower", pts: [[-2760, 2320], [-3150, 2800]] },
  { id: "t-metro", kind: "track", name: "Sump Lane", from: "ring", site: "metro", pts: [[-2950, 1980], [-2500, 1700]] },
  { id: "t-roofs", kind: "track", name: "Courier Cut", from: "ring", site: "roofs", pts: [[-3300, 1400], [-3620, 1680]] },
  { id: "t-park", kind: "track", name: "Deck Road", from: "ring", site: "carpark", pts: [[-1900, 3300], [-1800, 2980]] },
  { id: "t-gcity", kind: "track", name: "Depot Row", from: "ring", site: "g-city", pts: [[-2700, 2400]] },

  // The Sallow Sea
  { id: "t-tanker", kind: "track", name: "Keel Track", from: "ring", site: "tanker", pts: [[3300, -500], [3750, -610]] },
  { id: "t-ramps", kind: "track", name: "Sawtooth Track", from: "ring", site: "rampfield", pts: [[2800, -760], [2720, -470]] },
  { id: "t-camp", kind: "track", name: "Cinder Track", from: "ring", site: "camp", pts: [[3600, 300], [3300, 400]] },
  { id: "t-crash", kind: "track", name: "Lantern Track", from: "ring", site: "crash", pts: [[3610, 330], [3950, 420]] },
  { id: "t-gdunes", kind: "track", name: "Pump Row", from: "ring", site: "g-dunes", pts: [[3300, -500]] },
  { id: "bypass", kind: "track", name: "Span Bypass", from: "ring", to: "ring", pts: [[3396, -386], [3505, -335], [3565, -240], [3572, -160], [3525, -130]] },

  // The Drownings
  { id: "t-stilt", kind: "track", name: "Pole Road", from: "ring", site: "stilt", pts: [[2700, 2200], [2400, 1950]] },
  { id: "t-ferry", kind: "track", name: "Slipway", from: "ring", site: "ferry", pts: [[3050, 1650], [3500, 2200]] },
  { id: "t-rig", kind: "track", name: "Blackwell Causeway", from: "ring", site: "rig", pts: [[2300, 2750], [2800, 3400], [3100, 4000]] },
  { id: "t-nest", kind: "track", name: "Reed Track", from: "ring", site: "nest", pts: [[1900, 3300], [1700, 3100]] },
  { id: "t-gmarsh", kind: "track", name: "Shed Row", from: "ring", site: "g-marsh", pts: [[2700, 2200]] },
];

export const ROAD_W = { highway: 12, road: 8, track: 6 };
export const ROAD_STEP = 12; // metres between samples