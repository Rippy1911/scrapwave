// Builds a layout's pieces (maps/layout.js) with a place-kit frame: merged meshes, a box collider for every solid and
// post, a wedge collider for every ramp. Deco pieces (and lamps) are looks only; they may tilt (rx, rz).
import { rampGeometry } from "@/game/arena/shapes";

export function buildPieces(F, L, mat, deckY) {
  for (const p of L.pieces) {
    const m = mat(p.m), o = { rx: p.rx || 0, rz: p.rz || 0 };
    if (p.t === "ramp") {
      F.prim(rampGeometry(p.curve), m, p.x, p.y + p.h / 2, p.z, p.w, p.h, p.d, 0, p.r);
      F.wedge(p.x, p.z, p.w, p.d, p.h, p.r, { baseY: deckY + p.y, curve: p.curve });
    } else if (p.t === "cyl") F.cyl(m, p.x, p.y + p.h / 2, p.z, p.w / 2, p.h, { ...o, collide: p.solid, tag: "arena" });
    else if (p.t === "lamp") F.ball(m, p.x, p.y, p.z, p.w / 2);
    else F.box(m, p.x, p.y + p.h / 2, p.z, p.w, p.h, p.d, p.r, { ...o, collide: p.t === "solid", tag: "arena" });
  }
}