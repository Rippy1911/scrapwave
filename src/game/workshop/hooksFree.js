// window.scrapwake.workshop.free — free-build test hooks on a draft design (starts as the design you own).
// Every edit returns the draft's numbers; build() pays for the draft and drives it.
import { FREE_PARTS, freePartInfo } from "@/game/workshop/freeParts";
import { addPart, movePart, rotatePart, mirrorPart, removePart, setPartProps, copyParts, pasteParts, createHistory, findPart } from "@/game/workshop/freeEdit";
import { savePose, removePose } from "@/game/workshop/freePoses";
import { normalizeFree, partCap, freeCount } from "@/game/workshop/freeValidate";
import { compileDesign } from "@/game/workshop/compile";
import { ownedDesign, buildDesign, buildBill } from "@/game/workshop/economy";
import { normalizeDesign, copyDesign } from "@/game/workshop/validate";
import { encodeDesign, decodeDesign } from "@/game/workshop/blueprints";
import { wreckframeDesign } from "@/game/mech/wreckframe";

export function freeHooks(game) {
  const save = game.save, hist = createHistory();
  let draft = null, clip = null;
  const cur = () => (draft = draft || normalizeDesign(ownedDesign(save) || wreckframeDesign()));
  const set = (d, ids) => { hist.push(cur()); draft = d; return { ids: ids || [], ...h.info() }; };
  const h = {
    catalog: () => Object.keys(FREE_PARTS).map((t) => ({ type: t, group: FREE_PARTS[t].group, tiers: [1, 2, 3].map((k) => { const i = freePartInfo(t, k); return { tier: k, mass: i.mass, hp: i.hp, price: i.price, power: i.power, thrust: i.thrust, speed: i.speed }; }) })),
    draft: () => copyDesign(cur()),
    reset(kind) { draft = kind === "wreckframe" ? wreckframeDesign() : normalizeDesign((kind && game.workshop.resolve(kind)) || ownedDesign(save)); return h.info(); },
    info() { const c = compileDesign(cur()); return { parts: freeCount(cur()), cap: partCap(save.quality), summary: c.summary, mech: c.mech, bill: buildBill(save, cur()).total }; },
    part: (id) => findPart(cur(), id),
    add(type, at, o) { const r = addPart(cur(), type, at, o); return r.ids.length ? set(r.design, r.ids) : { ids: [], full: !!r.full, unique: !!r.unique }; },
    move: (id, at, o) => set(movePart(cur(), id, at, o)),
    rotate: (id, axis, o) => set(rotatePart(cur(), id, axis, o)),
    mirror(id) { const r = mirrorPart(cur(), id); return set(r.design, r.ids); },
    remove: (id, o) => set(removePart(cur(), id, o)),
    props: (id, patch, o) => set(setPartProps(cur(), id, patch, o)),
    copy(ids) { clip = copyParts(cur(), ids); return clip ? clip.length : 0; },
    paste(at, o) { const r = pasteParts(cur(), clip, at, o); return set(r.design, r.ids); },
    undo() { const d = hist.undo(cur()); if (d) draft = d; return !!d; },
    redo() { const d = hist.redo(cur()); if (d) draft = d; return !!d; },
    savePose: (name, key, values) => set(savePose(cur(), name, key, values)),
    removePose: (name) => set(removePose(cur(), name)),
    validate: (raw) => normalizeFree(raw),
    roundTrip() { const code = encodeDesign(cur()); const back = decodeDesign(code); return { ok: JSON.stringify(back.free) === JSON.stringify(cur().free), length: code.length }; },
    // Pay for the draft against the car you own and drive it now.
    build() { const r = buildDesign(save, cur(), game.noSave); if (r.ok && game.player) game.rebuildPlayer(); return { ok: r.ok, msg: r.msg, total: r.bill.total }; },
  };
  return h;
}