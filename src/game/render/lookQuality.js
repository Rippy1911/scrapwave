// What each quality preset draws of the world dressing (lane A look pass). QUALITY in data/tuning.js keeps the
// renderer knobs (shadow map size and range, AO, bloom, pixel ratio, far plane); this table scales the dressing:
//   cover       density of the near ground cover (grass tufts, pebbles) and coverR its radius in metres
//   decor       share of the collider-free scatter that is drawn (scree, small stones, brush, branches)
//   rockShadow  the big cliff blocks and fallen blocks cast sun shadows
//   solidShadow mid-size boulders and quiver trees cast them too
//   decorShadow so do brush, branches and small rocks
//   clouds      the cirrus layer in the sky
// Rocks, trees and wrecks that collide are drawn on every preset, so every player hits the same world.
import { RC } from "@/game/render/frame";

export const LOOK = {
  low: { cover: 0.3, coverR: 34, decor: 0.4, rockShadow: false, solidShadow: false, decorShadow: false, clouds: false },
  medium: { cover: 0.5, coverR: 46, decor: 0.6, rockShadow: true, solidShadow: false, decorShadow: false, clouds: true },
  high: { cover: 1, coverR: 72, decor: 1, rockShadow: true, solidShadow: true, decorShadow: true, clouds: true },
  ultra: { cover: 1.3, coverR: 96, decor: 1, rockShadow: true, solidShadow: true, decorShadow: true, clouds: true },
};

export const lookFor = (name = RC.quality) => LOOK[name] || LOOK.high;
