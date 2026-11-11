// The Saltreach basin as data. x = east, z = south (north is -z). Headings in degrees, 0 = north, 90 = east.
export const CANYON = {
  floorHalf: 20, rimHalf: 40, depth: 18,
  pts: [[-600, -560], [-470, -430], [-330, -300], [-220, -150], [-140, 0], [-40, 170], [90, 320], [260, 450], [600, 600]],
};

// Bridge endpoints sit on the rims either side of the canyon.
export const BRIDGES = {
  highway: { a: [-86, -29], b: [-194, 29], width: 16, gap: 30, kind: "highway" },
  rail: { a: [136, 280], b: [44, 360], width: 6, kind: "rail" },
  dam: { a: [-294, -338], b: [-366, -262], width: 12, kind: "dam" },
};

// A point flagged "b" starts a bridge segment to the next point (no terrain flattening, straight line).
export const ROADS = [
  { id: "highway", kind: "highway", width: 14, pts: [[305, -45], [190, -48], [70, -42], [-20, -36], [-86, -29, "b"], [-194, 29], [-290, 42], [-390, 40], [-470, 36]] },
  { id: "northway", kind: "highway", width: 12, pts: [[305, -45], [345, -170], [300, -330], [170, -420], [80, -430]] },
  { id: "southway", kind: "highway", width: 12, pts: [[305, -45], [345, 110], [390, 260], [420, 330]] },
  { id: "rail", kind: "rail", width: 7, pts: [[285, -10], [265, 110], [200, 230], [136, 280, "b"], [44, 360], [-60, 420], [-210, 405], [-330, 300], [-410, 160], [-450, 0], [-455, -120], [-410, -220], [-366, -262, "b"], [-294, -338], [-250, -400]] },
  { id: "ford", kind: "dirt", width: 9, pts: [[60, -40], [-10, 36], [-90, 85], [-170, 132], [-240, 120], [-290, 42]] },
  { id: "towerTrack", kind: "dirt", width: 8, pts: [[80, -430], [-60, -470], [-200, -478], [-250, -400]] },
  { id: "dunes", kind: "dirt", width: 8, pts: [[420, 330], [470, 450], [380, 540], [250, 520]] },
  { id: "westTrack", kind: "dirt", width: 8, pts: [[-470, 36], [-440, 200], [-345, 350]] },
  { id: "saltTrack", kind: "dirt", width: 8, pts: [[190, -48], [140, -200], [60, -330], [80, -430]] },
  { id: "eastTrack", kind: "dirt", width: 8, pts: [[345, -170], [470, -240], [500, -60], [345, 110]] },
];

export const PLACES = [
  { id: "town", name: "The Well-town", x: 300, z: -40, r: 72, pad: 80, icon: "town", safe: true },
  { id: "scrapN", name: "North Scrapyard", x: 60, z: -455, r: 48, pad: 55, icon: "scrap" },
  { id: "scrapSW", name: "Rattler Scrapyard", x: -345, z: 400, r: 48, pad: 55, icon: "scrap", rattlers: true },
  { id: "hbridge", name: "Highway Bridge", x: -140, z: 0, r: 60, icon: "bridge" },
  { id: "rbridge", name: "Rail Bridge", x: 90, z: 320, r: 50, icon: "bridge" },
  { id: "dam", name: "The Dry Dam", x: -330, z: -300, r: 60, icon: "dam" },
  { id: "refinery", name: "Burning Refinery", x: -505, z: 60, r: 62, pad: 70, icon: "fire" },
  { id: "tanker", name: "Beached Tanker", x: 455, z: 380, r: 60, pad: 70, icon: "ship" },
  { id: "tower", name: "Radio Tower", x: -205, z: -515, r: 35, pad: 40, icon: "radio" },
];

export const PLOTS = [
  { id: "p1", name: "Bridge East", x: -30, z: -100 },
  { id: "p2", name: "Bridge West", x: -260, z: -40 },
  { id: "p3", name: "Dam Crest", x: -235, z: -335 },
  { id: "p4", name: "Refinery Edge", x: -400, z: -70 },
  { id: "p5", name: "Canyon Mouth", x: 520, z: 470 },
  { id: "p6", name: "North Yard", x: 165, z: -500 },
  { id: "p7", name: "Rattler Flats", x: -470, z: 440 },
  { id: "p8", name: "Tanker Flats", x: 300, z: 300 },
  { id: "p9", name: "Salt Pan", x: 130, z: 110 },
  { id: "p10", name: "East Ridge", x: 440, z: -260 },
  { id: "p11", name: "North Pan", x: -60, z: -300 },
  { id: "p12", name: "West Mesa Gap", x: -230, z: 260 },
];

// Ramps. road ramps sit on a road at fraction t with a lateral offset; open ramps use x/z/heading.
// type: kicker (wood), mound (dirt), carrier (car trailer), bus (half-buried bus), dune
export const RAMPS = [
  { road: "highway", s: 238, off: 0, type: "kicker", first: true }, // the first ramp, ~150 m ahead of the spawn
  { road: "highway", s: 200, off: -9, type: "carrier" }, // before the bridge embankment: ramps sit level, so none on its slope
  { road: "highway", t: 0.30, off: 0, type: "mound", rev: true }, // #2: was t 0.72 (stepped run-up, bridge pier in the landing)
  { road: "highway", t: 0.73, off: -8, type: "bus" }, // #3: was t 0.88 off 9 (landing wall)
  { road: "northway", t: 0.3, off: 8, type: "kicker" },
  { road: "northway", t: 0.67, off: -8, type: "mound" }, // #5: was t 0.7 (landing wall, pole in the run-up)
  { road: "southway", t: 0.4, off: 8, type: "carrier" },
  { road: "southway", t: 0.84, off: 0, type: "kicker", rev: true }, // #7: was t 0.8 off -8 (landing wall)
  { road: "rail", t: 0.06, off: 9, type: "mound" },
  { road: "rail", t: 0.44, off: -9, type: "bus" },
  { road: "rail", t: 0.58, off: 8, type: "kicker", rev: true }, // #10: was t 0.62 off 9 (landing wall, rock in the landing)
  { road: "rail", t: 0.8, off: -9, type: "mound", rev: true },
  { road: "saltTrack", t: 0.35, off: 0, type: "kicker" },
  { road: "saltTrack", t: 0.67, off: 0, type: "mound", rev: true }, // #13: was t 0.7 (buried foot)
  { road: "eastTrack", t: 0.3, off: 0, type: "bus" },
  { road: "eastTrack", t: 0.83, off: 0, type: "kicker" }, // #15: was t 0.7 (run-up off a drop, buried foot)
  { road: "westTrack", t: 0.72, off: 0, type: "carrier" }, // #16: was t 0.5 (stepped run-up, foot in a slope)
  { x: -68, z: -471, heading: 255, type: "mound" }, // #17: was towerTrack t 0.4 (landing wall); same spot, turned along the track
  { x: 516, z: 451, heading: 15, type: "dune" }, // #18: was dunes road t 0.35 (stepped run-up, buried foot); off-road lip by the tanker
  { x: 320, z: 470, heading: 105, type: "dune" }, // #19: was dunes road t 0.7 (stepped run-up, buried foot, landing wall)
  { road: "ford", t: 0.15, off: 0, type: "kicker" },
  { x: 60, z: -150, heading: 120, type: "kicker" },
  { x: 140, z: -20, heading: 250, type: "mound" },
  { x: -10, z: -220, heading: 30, type: "carrier" },
  { x: 230, z: 150, heading: 200, type: "bus" },
  { x: 200, z: -260, heading: 300, type: "kicker" },
  { x: 380, z: 410, heading: 90, type: "dune" }, // #26: was (380, 470) heading 80 (9 m drop in the run-up)
  { x: 250, z: 430, heading: 120, type: "dune" }, // #27: was x 280 heading 160 (stepped run-up, landing wall)
  { x: -300, z: 180, heading: 20, type: "mound" },
  { x: -380, z: -150, heading: 170, type: "kicker" },
  { x: 480, z: 120, heading: 330, type: "mound" },
  { x: 20, z: 60, heading: 70, type: "kicker" },
];

export const CRASH_SITES = [[180, -330], [-120, -380], [420, -380], [10, 230], [-420, 260], [520, 220], [-260, 520]];

export const BILLBOARDS = [
  { x: 120, z: -60, heading: 180, text: "KESKO COLA", sub: "COLD AS THE OLD DAYS" },
  { x: -330, z: 60, heading: 0, text: "DUNMORE TYRES", sub: "ROLL ON, SALTREACH" },
  { x: 360, z: 160, heading: 270, text: "SALTREACH MOTEL", sub: "VACANCY · POOL (DRY)" },
  { x: 250, z: -370, heading: 90, text: "KESKO COLA", sub: "NOW WITH WATER" },
  { x: -20, z: 400, heading: 220, text: "DUNMORE TYRES", sub: "BUILT FOR RUIN" },
];

// Player spawn: on the open highway just outside the Well-town's west gate, facing out along the road.
// s = metres along the road from its first point, dir = +1 travels toward the road's end.
export const SPAWN = { town: { road: "highway", s: 88, dir: 1, clear: 6 } };
// The first-minute setup: a ramp straight ahead of the spawn and the first Rattler pack beyond it.
export const FIRST_MINUTE = { rampS: 238, packS: 540, packSize: 3 };
export const TEST_START = { x: 64, z: -42, heading: 270 }; // ~150 m before the highway bridge slab