// Poses of a free build: named joint values, optionally bound to a key 1-9 (at most 9 poses). A new pose with the
// same name or key replaces the old one. Ops return a new design; the input is never changed.
import { normalizeFree } from "@/game/workshop/freeValidate";
import { copyDesign } from "@/game/workshop/designs";

const withFree = (d, F) => { const out = { ...copyDesign(d), free: normalizeFree(F) }; if (!out.free) delete out.free; return out; };

export function savePose(d, name, key, values) {
  const F = copyDesign(d.free || { parts: [], poses: [], next: 1 });
  const nm = String(name || "Pose").slice(0, 16), k = Math.round(+key) || 0;
  F.poses = F.poses.filter((p) => p.name !== nm && !(k && p.key === k));
  F.poses.push({ name: nm, key: k, values: { ...values } });
  F.poses = F.poses.slice(-9);
  return withFree(d, F);
}

export function removePose(d, name) {
  if (!d.free) return d;
  const F = copyDesign(d.free);
  F.poses = F.poses.filter((p) => p.name !== name);
  return withFree(d, F);
}