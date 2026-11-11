import { WEAPONS } from "@/game/data/tuning";
import { weaponsFor, weaponInfo, MOUNT_PARTS } from "@/game/workshop/parts";
import { weaponDps } from "@/game/workshop/tiers";
import TierPips from "@/game/ui/workshop/TierPips";

// One weapon mount: empty or a weapon that fits its size, the weapon's tier, and its damage per second.
export default function MountRow({ index, size, side = null, weapon, owned, save, onWeapon, onTier }) {
  const info = weapon ? weaponInfo(weapon.id, weapon.tier) : null;
  const ownedTier = owned && weapon && owned.id === weapon.id ? owned.tier : 1;
  const chip = (on) => `rounded-sm border-2 px-2 py-1 text-[11px] uppercase tracking-wider transition-colors ${on ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#3d3832] bg-[#1c1a17] text-[#d8cbb2] hover:border-[#8a6a1e]"}`;
  return (
    <div className="flex flex-col gap-1.5 border-b border-[#2f2b26] pb-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">{side ? `${side === "left" ? "Left" : "Right"} side mount · small` : `Mount ${index + 1} · ${MOUNT_PARTS[size].name}`}</span>
        {weapon && <TierPips value={weapon.tier} onPick={onTier} save={save} base={WEAPONS[weapon.id].price} owned={ownedTier} />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(!weapon)} onClick={() => onWeapon(null)}>Empty</button>
        {weaponsFor(size).map((id) => (
          <button key={id} type="button" className={chip(weapon && weapon.id === id)} onClick={() => onWeapon(id)}>{WEAPONS[id].name}</button>
        ))}
      </div>
      {info && <div className="text-[10px] text-[#9d907b]">{info.name} · {Math.round(weaponDps(info.def))} dmg/s · {Math.round(info.def.range)} m · {info.mass} kg · {info.price} scrap</div>}
    </div>
  );
}