// The menu graph as data (docs/menus.md): each screen's parent. Back, and Esc, always go to the parent.
// (Named menuGraph.js so it never clashes with MenuFlow.jsx on case-insensitive file systems.)
export const PARENT = { title: null, play: "title", maps: "play", custom: "play", workshop: "title", settings: "title", profile: "title" };

// The Play menu: each row opens exactly one screen.
export const PLAY_ROWS = [
  { id: "roam", label: "Free Roam", sub: "The open Saltreach, solo or online" },
  { id: "arena", label: "Arena", sub: "Derby, horde nights and more in a walled world of its own" },
  { id: "race", label: "Wreck Race", sub: "Laps against the AI, weapons on" },
  { id: "custom", label: "Custom Game", sub: "Your own rules, presets and the map builder" },
  { id: "lobbies", label: "Online Lobbies", sub: "Join or host a match with other drivers" },
];

// The arena rule chips on the map picker (built-in presets).
export const ARENA_RULES = ["Derby", "Horde Night", "Checkpoint Rush", "Low Gravity", "Glass Cannons"];