import { useState } from "react";
import { VEHICLES, WEAPONS, ARMOUR_TIERS, MODULES, RAM } from "@/game/data/tuning";
import { CHASSIS, PAINTS, SIZE_ORDER } from "@/game/data/vehicles";
import { writeSave } from "@/game/core/save";
import ContractsPanel from "@/game/ui/ContractsPanel";
import { ensureWorkshop } from "@/game/workshop/store";
import { armourChange } from "@/game/workshop/economy";
import Workshop from "@/game/ui/workshop/Workshop";
import GarageTiers from "@/game/ui/workshop/GarageTiers";
import GarageBikes from "@/game/ui/workshop/GarageBikes";
import AircraftSection from "@/game/air/ui/AircraftSection";
import ShowcaseCard from "@/game/ui/ShowcaseCard";
import { showcaseList, showcaseCopy } from "@/game/workshop/showcase";

const PLAYABLE = ["jackal", "brawler", "mammoth", "bulwark"];

function Section({ title, children }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#c9a36a]">{title}</div>
      {children}
    </div>
  );
}

function Chip({ active, locked, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-sm border-2 px-3 py-2 text-left text-xs uppercase tracking-wider transition-colors ${active ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#46413a] bg-[#201d1a] text-[#d8cbb2] hover:border-[#8a6a1e]"} ${locked ? "opacity-80" : ""}`}>
      {children}
    </button>
  );
}

// Garage: chassis, paint, armour, weapons per hardpoint, ram and modules. Spending uses banked scrap.
export default function Garage({ save, game, onClose, onFly }) {
  const [, setTick] = useState(0);
  const [msg, setMsg] = useState("");
  const [shop, setShop] = useState(false);
  const ws = ensureWorkshop(save), noSave = !!(game && game.noSave);
  const note = (m) => { setMsg(m); setTick((t) => t + 1); };
  const g = save.garage, ch = g.chassis, lo = g.loadouts[ch];
  const commit = () => { writeSave(save); setTick((t) => t + 1); };
  const pay = (price, what) => {
    if (save.banked < price) { setMsg(`Need ${price - save.banked} more scrap for ${what}`); return false; }
    save.banked -= price; setMsg(price ? `Bought ${what} for ${price}` : ""); return true;
  };
  const pickChassis = (id) => {
    if (!g.owned.chassis.includes(id)) { if (!pay(VEHICLES[id].price, VEHICLES[id].name)) return; g.owned.chassis.push(id); }
    g.chassis = id; ws.ride = "garage"; commit();
  };
  const pickWeapon = (slot, wid) => {
    if (wid && !g.owned.weapons.includes(wid)) { if (!pay(WEAPONS[wid].price, WEAPONS[wid].name)) return; g.owned.weapons.push(wid); }
    lo[slot] = wid; commit();
  };
  const pickArmour = (tier) => {
    if ((g.armour[ch] || null) === tier) return;
    const c = armourChange(save, g.armour[ch], tier);
    if (c.locked) { setMsg(c.locked); return; }
    if (c.cost > 0) { if (!pay(c.cost, `${ARMOUR_TIERS.find((a) => a.id === tier).name} armour`)) return; }
    else { save.banked -= c.cost; setMsg(c.cost ? `Armour sold, ${-c.cost} refunded` : ""); }
    g.armour[ch] = tier; commit();
  };
  const toggleRam = () => {
    if (!g.owned.ram) { if (!pay(RAM.price, "Ram blade")) return; g.owned.ram = true; lo.ram = true; } else lo.ram = !lo.ram;
    commit();
  };
  const buyModule = (id) => {
    const mods = g.owned.modules;
    if (mods.includes(id)) { g.owned.modules = mods.filter((m) => m !== id); commit(); return; }
    if (!g.owned.boughtModules?.includes(id)) { if (!pay(MODULES[id].price, MODULES[id].name)) return; g.owned.boughtModules = [...(g.owned.boughtModules || []), id]; }
    g.owned.modules = [...mods, id]; commit();
  };

  if (shop) return <Workshop save={save} game={game} initial={shop.design} onClose={() => { setShop(false); setTick((t) => t + 1); }} />;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(10,7,5,0.78)] sw-body text-[#e9dcc4] p-3">
      <div className="sw-panel w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 md:p-6 flex flex-col gap-5 sw-slide">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="sw-display text-4xl text-[#f2c230]">GARAGE</h2>
            <div className="text-xs uppercase tracking-[0.25em] text-[#a8987f]">Well-town workshop · banked scrap <span className="text-[#7fe0a0] font-bold">{save.banked}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShop({})} className="sw-btn px-5 py-2 text-lg" title="Open the Workshop">Build</button>
            <button onClick={onClose} className="sw-btn sw-btn-primary px-8 py-2 text-lg">Roll out</button>
          </div>
        </div>
        {ws.ride === "design" && ws.built && <div className="text-xs uppercase tracking-[0.2em] text-[#a8987f]">Driving your built design <span className="text-[#f2c230]">{ws.built.name}</span> · pick a chassis below to drive a garage car</div>}
        {msg && <div className="text-sm text-[#f2c230]">{msg}</div>}
        <ContractsPanel save={save} />
        <Section title="Chassis">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PLAYABLE.map((id) => { const s = VEHICLES[id], owned = g.owned.chassis.includes(id); return (
              <Chip key={id} active={ch === id} onClick={() => pickChassis(id)}>
                <div className="sw-display text-base">{s.name}</div>
                <div className="normal-case tracking-normal text-[#a8987f]">{s.topSpeed} km/h · {s.hull} hull · {s.mass} kg</div>
                <div className="mt-1">{owned ? "Owned" : `${s.price} scrap`}</div>
              </Chip>
            ); })}
          </div>
        </Section>
        <Section title="Showcase · free, one of each, cannot be sold">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {showcaseList(save).map((r) => <ShowcaseCard key={r.id} ride={r} onEdit={() => setShop({ design: showcaseCopy(r.id) })} />)}
          </div>
          <div className="mt-1 text-[11px] text-[#a8987f]">Drive one from Choose your ride or summon it (Z on foot). Edit a copy opens it in the Workshop as your own design.</div>
        </Section>
        <Section title="Bikes">
          <GarageBikes save={save} noSave={noSave} onMsg={note} />
        </Section>
        <Section title="Upgrade tiers (garage car)">
          <GarageTiers save={save} noSave={noSave} onMsg={note} chassis={ch} />
        </Section>
        <Section title="Paint">
          <div className="flex flex-wrap gap-2">
            {PAINTS.map((p) => <button key={p} onClick={() => { g.paint = p; commit(); }} className={`h-8 w-8 rounded-sm border-2 ${g.paint === p ? "border-[#f2c230]" : "border-[#46413a]"}`} style={{ background: p }} />)}
          </div>
        </Section>
        <Section title="Weapons">
          <div className="flex flex-col gap-2">
            {CHASSIS[ch].hardpoints.map((hp) => (
              <div key={hp.id} className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs uppercase text-[#a8987f]">{hp.id} · {hp.size}</span>
                <Chip active={!lo[hp.id]} onClick={() => pickWeapon(hp.id, null)}>Empty</Chip>
                {Object.entries(WEAPONS).filter(([, w]) => SIZE_ORDER[w.size] <= SIZE_ORDER[hp.size]).map(([wid, w]) => (
                  <Chip key={wid} active={lo[hp.id] === wid} onClick={() => pickWeapon(hp.id, wid)}>{w.name}{!g.owned.weapons.includes(wid) && <span className="ml-1 text-[#c9a36a]">{w.price}</span>}</Chip>
                ))}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Armour (all zones)">
          <div className="flex flex-wrap gap-2">
            <Chip active={!g.armour[ch]} onClick={() => pickArmour(null)}>None</Chip>
            {ARMOUR_TIERS.map((t) => <Chip key={t.id} active={g.armour[ch] === t.id} onClick={() => pickArmour(t.id)}>{t.name} · {t.hp} hp/zone <span className="text-[#c9a36a]">{t.price}</span></Chip>)}
          </div>
        </Section>
        <Section title="Ram & modules">
          <div className="flex flex-wrap gap-2">
            <Chip active={g.owned.ram && lo.ram} onClick={toggleRam}>Ram blade {!g.owned.ram && <span className="text-[#c9a36a]">{RAM.price}</span>}</Chip>
            {Object.entries(MODULES).map(([id, m]) => (
              <Chip key={id} active={g.owned.modules.includes(id)} onClick={() => buyModule(id)}>
                {m.name} {!g.owned.boughtModules?.includes(id) && <span className="text-[#c9a36a]">{m.price}</span>}
                <div className="normal-case tracking-normal text-[#a8987f]">{m.desc}</div>
              </Chip>
            ))}
          </div>
        </Section>
        <Section title="Aircraft">
          <AircraftSection save={save} onFly={onFly} />
        </Section>
      </div>
    </div>
  );
}