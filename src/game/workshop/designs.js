// Ready-made designs: today's four cars (Jackal, Brawler, Mammoth, Rattler Pickup) and the three bikes, as part
// lists the Workshop can open and modify. A design: { v, name, parts: { slot: { id, tier } }, weapons: [{ id, tier } | null],
// paint }. The weapon list follows mountList(chassis): small mounts first, then medium, then large.
// 1: slots only. 2: adds the optional free build (`free`: grid parts, joints, poses, walker placements). Version 1
// blueprints load unchanged (normalizeDesign upgrades them in place).
export const DESIGN_VERSION = 2;

const T = (id, tier = 1) => ({ id, tier });
const W = (id, tier = 1) => (id ? { id, tier } : null);
const car = (name, parts, weapons, paint) => ({
  v: DESIGN_VERSION, name, paint,
  parts: { turbo: T("small"), tank: T("std"), armourFront: T("none"), armourSides: T("none"), armourRear: T("none"), armourRoof: T("none"), ram: T("none"), ...parts },
  weapons,
});
const bike = (name, id, paint) => ({ v: DESIGN_VERSION, name, paint, parts: { chassis: T(id), engine: T("bike"), tyres: T("bike"), turret: T("tail") }, weapons: [] });

export const PRESETS = [
  car("Jackal", { chassis: T("light"), cab: T("cage"), body: T("openbed"), engine: T("small"), tyres: T("road") }, [W("mg"), W("scatter"), null], "#c7762e"),
  car("Brawler", { chassis: T("medium"), cab: T("closed"), body: T("cargo"), engine: T("medium"), tyres: T("road"), ram: T("blade") }, [W("mg"), W("mg"), W("rockets"), null], "#7d8a80"),
  car("Mammoth", { chassis: T("six"), cab: T("armoured"), body: T("bus"), engine: T("large"), tyres: T("offroad"), ram: T("blade") }, [W("mg"), W("mg"), W("harpoon"), null, W("autocannon"), null], "#d9b23a"),
  car("Bulwark", { chassis: T("heavy"), cab: T("armoured"), body: T("armoured"), engine: T("large"), tyres: T("offroad"), ram: T("blade"), armourFront: T("plate"), armourSides: T("plate"), armourRear: T("plate"), armourRoof: T("plate") }, [W("mg"), null, W("cannon"), null], "#3f5f6e"),
  car("Rattler Pickup", { chassis: T("medium"), cab: T("closed"), body: T("openbed"), engine: T("medium"), tyres: T("offroad"), ram: T("blade") }, [W("mg"), null, W("rockets"), null], "#b23a1f"),
  bike("Dirt Bike", "dirtbike", "#d9b23a"),
  bike("Chopper", "chopper", "#2c2a28"),
  bike("Sidecar Rig", "sidecar", "#5e6b3a"),
];

// Which ready-made design stands in for a garage chassis (the parts you already own when you open the Workshop).
export const PRESET_FOR = { jackal: "Jackal", brawler: "Brawler", mammoth: "Mammoth", pickup: "Rattler Pickup", bulwark: "Bulwark", dirtbike: "Dirt Bike", chopper: "Chopper", sidecar: "Sidecar Rig" };
export const presetByName = (n) => PRESETS.find((p) => p.name.toLowerCase() === String(n).toLowerCase()) || null;
export const copyDesign = (d) => JSON.parse(JSON.stringify(d));