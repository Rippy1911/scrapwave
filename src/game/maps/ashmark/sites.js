// The Ashmark's places as plain data (map coordinates, see layout.js): points of interest, garages, the toll-gate
// outpost and the pieces of the highway (the gap jump, the two broken overpasses). roads.js gives every site its
// ground height and, for sites that stand on a road (snap), its spot and facing; siteBuild*.js lay out the pieces.
//   kind: "poi" | "garage" | "outpost" | "road" | "start"     r: radius of the levelled pad (0 = natural ground)
//   road: the track that ends at the site (its last sample sets the pad height)   snap: [road id] the site sits on
//   yaw: facing in radians (0 looks north, like a car's heading); snapped sites face along their road
export const SITES = [
  { id: "start", kind: "start", biome: "waste", name: "Ashmark Crossing", x: 0, z: 0, r: 0, story: "Where the flats road leaves the old survey marker." },

  // Old Varrow (city)
  { id: "tower", kind: "poi", biome: "city", name: "Halcyon Block", x: -3600, z: 3200, r: 62, yaw: 0.5, road: "t-tower", story: "Twenty floors came down in one night. The stair core still stands, and so does the lift motor on top of it." },
  { id: "metro", kind: "poi", biome: "city", name: "Sump Station", x: -2100, z: 1500, r: 46, yaw: -0.4, road: "t-metro", pit: true, story: "The Varrow underground filled with groundwater. The ticket hall is a pool with a ramp into it." },
  { id: "roofs", kind: "poi", biome: "city", name: "The Skyline Run", x: -3950, z: 2000, r: 84, yaw: 0.9, road: "t-roofs", story: "Five roofs joined by planks and ramps. Couriers used it to stay off the streets." },
  { id: "carpark", kind: "poi", biome: "city", name: "Level Nine", x: -1750, z: 2650, r: 72, yaw: 0.15, road: "t-park", story: "A car park with the top decks torn off. Arguments get settled on the open floor." },
  { id: "g-city", kind: "garage", biome: "city", name: "Varrow Garage", x: -2630, z: 2350, r: 40, road: "t-gcity", story: "A bus depot bay that still has a working door." },

  // The Spine (mountains)
  { id: "dam", kind: "poi", biome: "spine", name: "Greywater Dam", x: 1400, z: -3500, r: 0, snap: "rim", story: "The gate blew out and took the lake with it. The crest road still crosses, forty metres over the sluiceway." },
  { id: "mast", kind: "poi", biome: "spine", name: "Signal Crown", x: -1020, z: -2520, r: 26, cut: 8, yaw: 0, road: "t-climb", story: "The relay mast on the highest summit. Somebody keeps its red lamp lit; nobody knows who." },
  { id: "tunnel", kind: "poi", biome: "spine", name: "Coldwater Gallery", x: 2800, z: -2825, r: 0, snap: "gorge", story: "A rock-fall gallery over the sluiceway road. Half its roof lights still work." },
  { id: "launch", kind: "poi", biome: "spine", name: "Kestrel Drop", x: -905, z: -2090, r: 24, yaw: -1.49, road: "t-launch", story: "A ramp bolted to the cliff edge above the pass. Wings and turbo decide how far you get." },
  { id: "g-spine", kind: "garage", biome: "spine", name: "Passfoot Garage", x: -415, z: -1560, r: 38, road: "t-gspine", story: "A plough shed at the bottom of the pass." },

  // The Sallow Sea (dunes)
  { id: "tanker", kind: "poi", biome: "dunes", name: "The Marrow", x: 4150, z: -680, r: 58, yaw: 0.7, road: "t-tanker", story: "A tanker that ran aground when there was still a sea here. The dunes have taken the stern." },
  { id: "rampfield", kind: "poi", biome: "dunes", name: "Sawtooth Field", x: 2650, z: -200, r: 28, yaw: 0, road: "t-ramps", story: "Somebody dragged a dozen ramps onto the dune crests and never came back for them." },
  { id: "camp", kind: "poi", biome: "dunes", name: "Cinder Camp", x: 3000, z: 380, r: 42, road: "t-camp", story: "A scrap camp round a fire pit that is still warm. Whoever lives here left in a hurry." },
  { id: "crash", kind: "poi", biome: "dunes", name: "Fallen Lantern", x: 4250, z: 480, r: 48, yaw: -0.8, road: "t-crash", horde: "aliens", story: "Something came down hot and ploughed a trench through the sand. Its crew is still looking for a way home." },
  { id: "g-dunes", kind: "garage", biome: "dunes", name: "Sallow Garage", x: 3240, z: -440, r: 38, road: "t-gdunes", story: "A pump house dug out of a dune." },

  // The Drownings (salt marsh)
  { id: "stilt", kind: "poi", biome: "marsh", name: "Stiltwick", x: 2100, z: 1700, r: 30, yaw: 0.3, road: "t-stilt", story: "A village on poles, joined by boardwalks. The boats are gone and the doors are open." },
  { id: "ferry", kind: "poi", biome: "marsh", name: "The Lowtide Ferry", x: 3900, z: 2600, r: 34, yaw: -0.5, road: "t-ferry", story: "The last crossing never finished. The car deck is still full." },
  { id: "rig", kind: "poi", biome: "marsh", name: "Blackwell Rig", x: 3300, z: 4620, r: 28, yaw: 0.32, road: "t-rig", story: "A drilling platform at the end of a stone causeway. The flare stack still burns off what comes up." },
  { id: "nest", kind: "poi", biome: "marsh", name: "The Reedbed", x: 1500, z: 2900, r: 36, yaw: 0, road: "t-nest", horde: "zombies", story: "The reeds here move against the wind. Whatever went into the water came back out hungry." },
  { id: "g-marsh", kind: "garage", biome: "marsh", name: "Drownings Garage", x: 2630, z: 2150, r: 38, road: "t-gmarsh", story: "A boat shed on the one dry rise for a kilometre." },

  // On the highway
  { id: "toll", kind: "outpost", biome: "waste", name: "The Last Toll", x: -2880, z: -200, r: 36, snap: "ring", story: "A toll plaza with the barriers welded open. Traders took the booths." },
  { id: "span", kind: "road", biome: "dunes", name: "The Broken Span", x: 3480, z: -241, r: 0, snap: "ring", story: "The middle of the viaduct is gone. The highway carries on regardless." },
  { id: "ruin-a", kind: "road", biome: "waste", name: "Ashmark Interchange", x: 700, z: -1100, r: 36, snap: "ring", story: "An overpass to nowhere, down on both sides of the highway." },
  { id: "ruin-b", kind: "road", biome: "city", name: "Varrow Flyover", x: -2300, z: 2850, r: 36, snap: "ring", story: "The city's ring flyover, dropped across its own on-ramps." },
];

export const siteById = (id) => SITES.find((s) => s.id === id) || null;
export const GARAGES = SITES.filter((s) => s.kind === "garage");
export const POIS = SITES.filter((s) => s.kind === "poi");
/** Sites with a trader and a safe ring: every garage and the toll gate. */
export const OUTPOSTS = SITES.filter((s) => s.kind === "garage" || s.kind === "outpost");