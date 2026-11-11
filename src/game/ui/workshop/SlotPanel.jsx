import { slotsFor, mountList, mountSide, clsOf } from "@/game/workshop/parts";
import { normalizeDesign, designClass, copyDesign } from "@/game/workshop/validate";
import { presetByName, PRESET_FOR } from "@/game/workshop/designs";
import SlotRow from "@/game/ui/workshop/SlotRow";
import MountRow from "@/game/ui/workshop/MountRow";

// Part slots and weapon mounts of the draft. Switching between a car and a bike frame starts from that class's design.
export default function SlotPanel({ design, owned, save, onChange }) {
  const cls = designClass(design), ownSame = owned && owned.parts.chassis.id === design.parts.chassis.id;
  const edit = (fn) => { const d = copyDesign(design); fn(d); onChange(normalizeDesign(d)); };
  const setPart = (key, id) => {
    if (key === "chassis" && clsOf(id) !== cls) {
      const base = copyDesign(presetByName(PRESET_FOR[id] || "Jackal"));
      base.parts.chassis = { id, tier: 1 }; base.name = design.name; base.paint = design.paint;
      onChange(normalizeDesign(base));
      return;
    }
    edit((d) => { d.parts[key] = { id, tier: d.parts[key]?.id === id ? d.parts[key].tier : 1 }; });
  };
  return (
    <div className="flex flex-col gap-2.5">
      {slotsFor(cls).map((s) => (
        <SlotRow key={s.key} slot={s.key} cls={cls} part={design.parts[s.key]} owned={owned?.parts[s.key]} save={save}
          onPart={(id) => setPart(s.key, id)} onTier={(t) => edit((d) => { d.parts[s.key].tier = t; })} />
      ))}
      {mountList(design.parts.chassis.id).map((size, i) => (
        <MountRow key={i} index={i} size={size} side={mountSide(design.parts.chassis.id, i)} weapon={design.weapons[i]} owned={ownSame ? owned.weapons[i] : null} save={save}
          onWeapon={(id) => edit((d) => { d.weapons[i] = id ? { id, tier: 1 } : null; })}
          onTier={(t) => edit((d) => { d.weapons[i].tier = t; })} />
      ))}
    </div>
  );
}