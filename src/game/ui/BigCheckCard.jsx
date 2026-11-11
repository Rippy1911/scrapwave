import { useEffect, useState } from "react";
import CheckTable from "@/game/ui/CheckTable";

// ?bigcheck=1: the Ashmark check (maps/ashmark/check.js). One row per biome spot, then one per garage and the toll.
const SPOT_HEAD = ["Spot", "Biome", "Settle s", "Tiles 0/1/2", "Colliders", "Build max ms", "Draw calls", "k tris", "Frame ms", "Heap MB", "Above ground", "Roads", "Places", "Place max ms", "Scatter", "Weather"];
const STOP_HEAD = ["Outpost", "Settle s", "Built", "Safe ring", "Inside m", "Guns off", "Traders", "Garage bay", "Repair", "Above ground"];
const yn = (v) => (v ? "yes" : "NO");
const spotCells = (r) => [r.spot, r.biome, r.settleS, r.byDetail, r.colliders, r.buildMaxMs, r.drawCalls, r.ktris, r.frameMs, r.heapMB ?? "-", r.aboveGround, r.roads, r.places, r.placeMaxMs, r.scatter, r.weather ?? "-"];
// A garage must have a bay and mend the car; the toll gate has neither.
const stopCells = (s) => [s.stop, s.settleS, yn(s.built), s.ring ? s.ring.replace("ash-", "") : "NO", s.insideM ?? "-", yn(s.gunsOff), s.traders || "NO", s.garage ? yn(s.bay) : "-", s.garage ? (s.repairPct > 0 ? "+" + s.repairPct + "%" : "NO") : s.repairPct + "%", s.aboveGround];

export default function BigCheckCard() {
  const [rep, setRep] = useState(null);
  useEffect(() => {
    const id = setInterval(() => { const r = window.scrapwake && window.scrapwake.big.check(); if (r) setRep({ ...r, rows: r.rows.slice(), stops: r.stops.slice() }); }, 500);
    return () => clearInterval(id);
  }, []);
  if (!rep) return null;
  return (
    <div className="pointer-events-none fixed left-3 top-3 z-[60] sw-panel px-4 py-3 sw-body text-xs text-[#efe3cb]">
      <div className="sw-display mb-1 text-base text-[#f2c230]">BIG MAP CHECK · {rep.done ? "DONE" : "RUNNING"} · rescues {rep.rescues}</div>
      <CheckTable head={SPOT_HEAD} rows={rep.rows.map(spotCells)} />
      {rep.stops.length > 0 && <div className="mt-2"><CheckTable head={STOP_HEAD} rows={rep.stops.map(stopCells)} /></div>}
    </div>
  );
}