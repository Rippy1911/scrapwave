// Brasswater City (round 16): one open city 1.4 km across for free roam, hunt, Wreck and flight. A 100 m grid of
// avenues and side streets, a downtown of towers with helipads, rooftop jump routes, a ring road with a flyover, a
// harbour with gantry cranes, a stadium, a park, an airfield, alleys and a tunnel under the central plaza, and the
// Brass Needle that you can see from anywhere. The layout here is plain data (maps/layout.js) for the structures;
// the buildings, street kit, breakables and crowds are built at load by maps/city/index.js (the map's `extra`).
import { createLayout } from "@/game/maps/layout";
import { buildPlan, CITY } from "@/game/maps/city/plan";
import { buildStructures } from "@/game/maps/city/structures";
import { drawCity } from "@/game/maps/city/mapArt";
import { buildCity } from "@/game/maps/city";

function build() {
  const plan = buildPlan();
  const B = createLayout({ R: CITY.R, floor: "dark", outer: "sand", wall: "concrete", horizon: "rock", tint: "#3a3732",
    sky: { hour: 20.2, weather: "clear" }, landmark: { name: "The Brass Needle", x: 0, z: 0 } });
  buildStructures(B, plan);
  const L = B.L;
  L.plan = plan; L.paint = drawCity; L.air = plan.air;
  L.spawns.push(...plan.spawns); L.checkpoints.push(...plan.cps); L.power.push(...plan.power); L.horde.push(...plan.horde); L.props.push(...plan.props);
  return B.done();
}

export const BRASSWATER_CITY = {
  id: "city", kind: "arena", also: ["roam"], name: "Brasswater City", landmark: "The Brass Needle", size: [1400, 1400], build, extra: buildCity,
  // 1.4 km does not fit the free-roam world (its edge walls stand at +-591 m and reach y 240), so the deck stands above them.
  site: (s) => ({ ...s, y: Math.max(s.y, 250) }),
  // What Free Roam starts with here (the picker applies it over the default rules): no opponents, the city tour optional.
  roamRules: { mode: "arena", aiCount: 0, horde: "off", win: "any", timeLimit: 600, powerups: true, fuel: false, building: false, raids: false },
  blurb: "A city 1.4 km across at night: avenues, towers, rooftop jump routes, a flyover, a harbour, a stadium and an airfield. Zombies on the streets, aliens on the roofs.",
  tip: "The Brass Needle shows from anywhere. Roof ramps at the street ends of Tin Row, Copper Run and Slate Strip take you up; the tunnel runs under the plaza.",
};
