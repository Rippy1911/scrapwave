// Garage "Aircraft" entry: what the helicopter still needs, then Buy; once owned, repairs, upgrades and Fly.
import { useState } from "react";
import { unlockStatus } from "@/game/air/progress";
import { buyHeli, buyTier, repairHeli, repairCost, heliHull } from "@/game/air/economy";
import { UNLOCK, statsFor, airSave } from "@/game/air/tiers";
import AircraftUpgrades from "@/game/air/ui/AircraftUpgrades";

const Need = ({ ok, children }) => <li className={ok ? "text-[#7fe0a0]" : "text-[#e9dcc4]"}>{ok ? "✓" : "○"} {children}</li>;

export default function AircraftSection({ save, onFly }) {
  const [msg, setMsg] = useState("");
  const [, setTick] = useState(0);
  const run = (r) => { setMsg(r.msg); setTick((t) => t + 1); };
  const s = unlockStatus(save), name = statsFor("heli", airSave(save).tiers).name;
  if (!s.owned) return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-[#d8cbb2]">{name} · gunship helicopter · late unlock</div>
      <ul className="text-sm">
        <Need ok={s.rank}>High rank: beat the Warlord <span className="text-[#a8987f]">or</span> finish {s.jobsNeed} jobs and contracts ({Math.min(s.jobs, s.jobsNeed)} / {s.jobsNeed}{s.story ? " · Warlord beaten" : ""})</Need>
        <Need ok={s.banked >= s.price}>{s.price} banked scrap ({s.banked} now)</Need>
      </ul>
      <button disabled={!s.canBuy} onClick={() => run(buyHeli(save))} className={`sw-btn w-fit px-5 py-2 text-sm ${s.canBuy ? "sw-btn-primary" : "opacity-60"}`}>Buy · {s.price}</button>
      {msg && <div className="text-xs text-[#f2c230]">{msg}</div>}
    </div>
  );
  const h = heliHull(save), cost = repairCost(save);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[#d8cbb2]">{name} · hull {h.hp} / {h.max}</span>
        <span className="text-[#a8987f]">Upkeep {UNLOCK.upkeep}/day · repairs {UNLOCK.repairPerHp} scrap/HP · refuel at outposts and bases</span>
      </div>
      <AircraftUpgrades save={save} onBuy={(id) => run(buyTier(save, id))} />
      <div className="flex flex-wrap gap-2">
        {cost > 0 && <button onClick={() => run(repairHeli(save))} className="sw-btn px-4 py-2 text-sm">Repair · {cost}</button>}
        <button disabled={h.hp <= 0} onClick={onFly} className={`sw-btn sw-btn-primary px-5 py-2 text-sm ${h.hp <= 0 ? "opacity-60" : ""}`}>Fly the {name}</button>
      </div>
      {msg && <div className="text-xs text-[#f2c230]">{msg}</div>}
    </div>
  );
}