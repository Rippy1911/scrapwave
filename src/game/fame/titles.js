// Fame tracks, rank thresholds and the full title table (cosmetic only).

export const TRACKS = [
  { id: "carnage", name: "Carnage", color: "#ff5a3c" },
  { id: "speed", name: "Speed", color: "#5ad1ff" },
  { id: "stunts", name: "Stunts", color: "#f2c230" },
  { id: "survival", name: "Survival", color: "#7fe0a0" },
  { id: "salvage", name: "Salvage", color: "#c9a36a" },
  { id: "sky", name: "Sky", color: "#b89cff" },
];

export const RANK_COUNT = 10;

// Fame points needed for each track rank (rank 1 = index 0, … rank 10 = index 9).
export const TRACK_THRESHOLDS = [0, 30, 75, 140, 230, 340, 480, 660, 880, 1150];

// Overall rank uses the sum of all track fame.
export const OVERALL_THRESHOLDS = [0, 180, 450, 900, 1500, 2300, 3300, 4600, 6200, 8200];

export const TOP_OVERALL_TITLE = "Post-Apocalyptic Overlord";

const TRACK_TITLES = {
  carnage: [
    "Fender Bender", "Paint Swapper", "Bumper Thief", "Road Butcher", "Wreckmonger",
    "Carnage Courier", "Hull Harvester", "Ruin Reveler", "Obliteration Artist", "Total Annihilator",
  ],
  speed: [
    "Gutter Racer", "Dust Dragster", "Kerb Kisser", "Red-Line Saint", "Slipstream Prophet",
    "Nitro Nomad", "Apex Anarchist", "Salt Flats Seraph", "Velocity Vicar", "Timewarp Tyrant",
  ],
  stunts: [
    "Ramp Taster", "Hangtime Hobo", "Rollaway Rogue", "Flip Fiend", "Skywriting Saboteur",
    "Barrel Roll Baron", "Inverted Icon", "Gravity Griever", "Aerial Anomaly", "Orbit Overlord",
  ],
  survival: [
    "Dustland Survivor", "Storm Dodger", "Horde Outrunner", "Ashmark Endurer", "Epoch Walker",
    "Dustwall Defender", "Last Light Keeper", "Wasteland Warden", "Apocalypse Anchor", "Eternity Drifter",
  ],
  salvage: [
    "Scrap Picker", "Junk Jaunter", "Parts Pilgrim", "Workshop Wrangler", "Blueprint Bandit",
    "Upgrade Urchin", "Hoard Highwayman", "Salvage Sage", "Refinery Regent", "Scrap Sovereign",
  ],
  sky: [
    "Cloud Skimmer", "Rotor Rookie", "Thermals Thief", "Stratos Stalker", "Death-From-Above Dropout",
    "Jetstream Jester", "Sky Reaper", "Horizon Hunter", "Celestial Corsair", "Stratosphere Sultan",
  ],
};

export const OVERALL_TITLES = [
  "Drifter",
  "Road Scrapper",
  "Saltreach Regular",
  "Wasteland Veteran",
  "Convoy Terror",
  "Storm Rider",
  "Scrap Baron",
  "Ashmark Legend",
  "Dune Emperor",
  TOP_OVERALL_TITLE,
];

/** Every title id: `track:rank` or `overall:rank` (1-based rank). */
export function titleId(track, rank) {
  return `${track}:${rank}`;
}

export function titleLabel(id) {
  const [kind, r] = String(id || "").split(":");
  const rank = Math.max(1, Math.min(RANK_COUNT, +r || 1)) - 1;
  if (kind === "overall") return OVERALL_TITLES[rank] || OVERALL_TITLES[0];
  const list = TRACK_TITLES[kind];
  return list ? list[rank] : "Unknown";
}

export function allTitleIds() {
  const out = [];
  for (let i = 1; i <= RANK_COUNT; i++) out.push(titleId("overall", i));
  for (const t of TRACKS) for (let i = 1; i <= RANK_COUNT; i++) out.push(titleId(t.id, i));
  return out;
}

export function rankForPoints(points, thresholds = TRACK_THRESHOLDS) {
  let rank = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (points >= thresholds[i]) rank = i + 1;
    else break;
  }
  return Math.min(RANK_COUNT, rank);
}

export function progressToNext(points, thresholds = TRACK_THRESHOLDS) {
  const rank = rankForPoints(points, thresholds);
  if (rank >= RANK_COUNT) return { rank, next: null, pct: 1, floor: thresholds[RANK_COUNT - 1], ceil: thresholds[RANK_COUNT - 1] };
  const floor = thresholds[rank - 1];
  const ceil = thresholds[rank];
  const pct = ceil > floor ? (points - floor) / (ceil - floor) : 1;
  return { rank, next: rank + 1, pct: Math.max(0, Math.min(1, pct)), floor, ceil };
}

export function unlockedTitleIds(fame) {
  const ids = [];
  const total = TRACKS.reduce((s, t) => s + (fame[t.id] || 0), 0);
  const or = rankForPoints(total, OVERALL_THRESHOLDS);
  for (let i = 1; i <= or; i++) ids.push(titleId("overall", i));
  for (const t of TRACKS) {
    const r = rankForPoints(fame[t.id] || 0, TRACK_THRESHOLDS);
    for (let i = 1; i <= r; i++) ids.push(titleId(t.id, i));
  }
  return ids;
}

export function overallRank(fame) {
  const total = TRACKS.reduce((s, t) => s + (fame[t.id] || 0), 0);
  return rankForPoints(total, OVERALL_THRESHOLDS);
}

/** Emblem parts unlocked by combined track + overall rank (cosmetic gates). */
export function unlockTier(fame) {
  return Math.min(RANK_COUNT, Math.max(overallRank(fame), ...TRACKS.map((t) => rankForPoints(fame[t.id] || 0))));
}
