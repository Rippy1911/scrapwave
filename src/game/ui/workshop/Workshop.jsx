import { useMemo, useState } from "react";
import { PAINTS } from "@/game/data/vehicles";
import { PRESETS } from "@/game/workshop/designs";
import { compileDesign } from "@/game/workshop/compile";
import { normalizeDesign } from "@/game/workshop/validate";
import { ownedDesign, buildBill, buildDesign } from "@/game/workshop/economy";
import { ensureWorkshop, commit } from "@/game/workshop/store";
import Turntable from "@/game/ui/workshop/Turntable";
import SlotPanel from "@/game/ui/workshop/SlotPanel";
import StatsPanel from "@/game/ui/workshop/StatsPanel";
import BlueprintPanel from "@/game/ui/workshop/BlueprintPanel";
import TierLegend from "@/game/ui/workshop/TierLegend";
import FreeBuild from "@/game/ui/workshop/FreeBuild";
import WingsPanel from "@/game/ui/workshop/WingsPanel";
import WorkshopIntro from "@/game/ui/workshop/WorkshopIntro";
import { SHOWCASE, showcaseCopy } from "@/game/workshop/showcase";

// The Workshop: build a car (or a bike) from parts on a turntable, see the numbers change, build it for scrap.
// initial: a design to open with (a showcase copy from "Edit a copy"); otherwise the car you own.
export default function Workshop({ save, game, onClose, initial }) {
  const owned = useMemo(() => ownedDesign(save), [save, save.workshop?.built]); // eslint-disable-line react-hooks/exhaustive-deps
  const [design, setDesign] = useState(() => (initial ? normalizeDesign(initial) : owned || normalizeDesign(PRESETS[0])));
  const [msg, setMsg] = useState(initial ? `Editing your copy: ${initial.name}. Change anything, then Build.` : "");
  const [help, setHelp] = useState(false);
  const [free, setFree] = useState(false);
  const [, setTick] = useState(0);
  const c = useMemo(() => compileDesign(design), [design]);
  const ownedSum = useMemo(() => (owned ? compileDesign(owned).summary : null), [owned]);
  const bill = buildBill(save, design), ws = ensureWorkshop(save), noSave = !!(game && game.noSave);
  const build = () => { const r = buildDesign(save, design, noSave); setMsg(r.msg); setTick((t) => t + 1); };
  const rideGarage = () => { ws.ride = "garage"; commit(save, noSave); setMsg("You will roll out in your garage car"); setTick((t) => t + 1); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,6,4,0.86)] p-2 sw-body text-[#e9dcc4] md:p-4">
      <div className="sw-panel flex max-h-[96vh] w-full max-w-7xl flex-col gap-4 overflow-y-auto p-4 md:p-5 sw-slide">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="sw-display text-4xl text-[#f2c230]">WORKSHOP</h2>
            <div className="text-xs uppercase tracking-[0.25em] text-[#a8987f]">Weld it from parts · banked scrap <span className="font-bold text-[#7fe0a0]">{save.banked}</span> · driving <span className="text-[#e9dcc4]">{ws.ride === "design" && ws.built ? ws.built.name : "garage car"}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setHelp(true)} className="sw-btn px-4 py-2 text-xs">How it works</button>
            {c.cls !== "bike" && <button type="button" title="Free grid, joints, poses and the Transform Core" onClick={() => setFree(!free)} className={`sw-btn px-4 py-2 text-xs ${free ? "sw-btn-primary" : ""}`}>{free ? "Slot parts" : "Mech builder · free build"}</button>}
            {ws.ride === "design" && <button type="button" onClick={rideGarage} className="sw-btn px-4 py-2 text-xs">Drive garage car</button>}
            <button type="button" onClick={build} disabled={bill.locked.length > 0} className="sw-btn sw-btn-primary px-6 py-2 text-base disabled:opacity-50">Build · {bill.total < 0 ? `+${-bill.total}` : bill.total}</button>
            <button type="button" onClick={onClose} className="sw-btn px-5 py-2 text-base">Back</button>
          </div>
        </div>
        {msg && <div className="text-sm text-[#f2c230]">{msg}</div>}
        <WorkshopIntro force={help} onClose={() => setHelp(false)} />
        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Ready-made</span>
          {PRESETS.map((p) => <button key={p.name} type="button" onClick={() => setDesign(normalizeDesign(p))} className="sw-btn px-3 py-1 text-[11px]">{p.name}</button>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-[11px] uppercase tracking-[0.25em] text-[#c9a36a]">Showcase · edit a copy</span>
          {SHOWCASE.map((s) => <button key={s.id} type="button" title={s.type} onClick={() => { setDesign(showcaseCopy(s.id)); setMsg(`${s.name}: ${s.blurb}`); }} className="sw-btn px-3 py-1 text-[11px]">{s.name}</button>)}
        </div>
        <TierLegend save={save} />
        {free ? (
          <FreeBuild design={design} setDesign={setDesign} game={game} save={save} c={c} bill={<StatsPanel summary={c.summary} owned={ownedSum} bill={bill} banked={save.banked} />} />
        ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1.1fr_0.95fr]">
          <div className="order-2 flex flex-col gap-3 lg:order-1">
            <SlotPanel design={design} owned={owned} save={save} onChange={setDesign} />
            {c.cls !== "bike" && <WingsPanel design={design} onChange={setDesign} mass={c.summary.mass} />}
          </div>
          <div className="order-1 flex flex-col gap-2 lg:order-2">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border-2 border-[#3d3832] bg-[radial-gradient(ellipse_at_center,#3a3128_0%,#14110e_75%)]">
              <Turntable game={game} design={design} />
              <div className="pointer-events-none absolute left-3 top-2 sw-display text-lg text-[#f2c230]">{design.name}</div>
              <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">{c.cls === "bike" ? "Bike · tail turret · trap drop slot" : `${c.chassis.wheels.length} wheels · ${c.chassis.hardpoints.length} mounts`}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PAINTS.map((p) => <button key={p} type="button" aria-label={`Paint ${p}`} onClick={() => setDesign({ ...design, paint: p })} className={`h-7 w-7 rounded-sm border-2 ${design.paint === p ? "border-[#f2c230]" : "border-[#46413a]"}`} style={{ background: p }} />)}
            </div>
          </div>
          <div className="order-3 flex flex-col gap-4">
            <StatsPanel summary={c.summary} owned={ownedSum} bill={bill} banked={save.banked} />
            <BlueprintPanel save={save} design={design} onLoad={(d) => setDesign(normalizeDesign(d))} onMsg={setMsg} noSave={noSave} />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}