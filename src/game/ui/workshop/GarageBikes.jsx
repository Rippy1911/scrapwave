import { presetByName } from "@/game/workshop/designs";
import { compileDesign } from "@/game/workshop/compile";
import { buildBill, buildDesign } from "@/game/workshop/economy";
import { ensureWorkshop } from "@/game/workshop/store";

const BIKES = ["Dirt Bike", "Chopper", "Sidecar Rig"];

// The three bikes, bought (and ridden) straight from the garage. Each has a tail auto-turret and the trap drop slot.
export default function GarageBikes({ save, noSave, onMsg }) {
  const ws = ensureWorkshop(save), riding = ws.ride === "design" && ws.built ? ws.built.parts.chassis.id : null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {BIKES.map((n) => {
        const d = presetByName(n), id = d.parts.chassis.id, s = compileDesign(d).summary, bill = buildBill(save, d), on = riding === id;
        return (
          <button key={n} type="button" onClick={() => onMsg(on ? "" : buildDesign(save, d, noSave).msg)}
            className={`rounded-sm border-2 px-3 py-2 text-left text-xs uppercase tracking-wider transition-colors ${on ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#46413a] bg-[#201d1a] text-[#d8cbb2] hover:border-[#8a6a1e]"}`}>
            <div className="sw-display text-base">{n}</div>
            <div className="normal-case tracking-normal text-[#a8987f]">{s.topSpeed} km/h · {s.hull} hull · {s.mass} kg</div>
            <div className="mt-1">{on ? "Riding" : bill.total <= 0 ? "Ride" : `${bill.total} scrap`}</div>
          </button>
        );
      })}
    </div>
  );
}