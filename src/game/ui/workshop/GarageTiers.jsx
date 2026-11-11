import { WEAPONS, MODULES, UPGRADES } from "@/game/data/tuning";
import { setTier, currentTier, upgradeBase } from "@/game/workshop/economy";
import { roman, statMul } from "@/game/workshop/tiers";
import TierPips from "@/game/ui/workshop/TierPips";

// Tier I / II / III rows for the garage car: engine, tyres, turbo, tank, the ram, every owned weapon and module.
export default function GarageTiers({ save, noSave, onMsg, chassis }) {
  const g = save.garage;
  const ch = chassis || g.chassis;
  const rows = [
    ...["engine", "tyres", "turbo", "tank"].map((k) => ({ kind: k, id: null, name: UPGRADES[k].name, desc: UPGRADES[k].desc })),
    ...(ch === "bulwark" ? [{ kind: "traverse", id: null, name: UPGRADES.traverse.name, desc: UPGRADES.traverse.desc }] : []),
    ...(g.owned.ram ? [{ kind: "ram", id: null, name: "Ram blade", desc: "ram damage" }] : []),
    ...g.owned.weapons.filter((id) => WEAPONS[id]).map((id) => ({ kind: "weapon", id, name: WEAPONS[id].name, desc: "damage, range, reload" })),
    ...(g.owned.boughtModules || []).filter((id) => MODULES[id]).map((id) => ({ kind: "module", id, name: MODULES[id].name, desc: "module strength" })),
  ];
  const pick = (r, t) => { const res = setTier(save, r.kind, r.id, t, noSave); onMsg(res.msg || ""); };
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
      {rows.map((r) => {
        const cur = currentTier(save, r.kind, r.id);
        return (
          <div key={`${r.kind}:${r.id}`} className="flex items-center justify-between gap-2 border-b border-[#2f2b26] pb-1.5">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-[#e9dcc4]">{r.name} <span className="text-[#f2c230]">{roman(cur)}</span></div>
              <div className="text-[10px] text-[#8f8270]">{r.desc} ×{statMul(cur)}</div>
            </div>
            <TierPips value={cur} owned={cur} save={save} base={upgradeBase(r.kind, r.id)} onPick={(t) => pick(r, t)} />
          </div>
        );
      })}
    </div>
  );
}