// Admin panel: spawn any vehicle (cars, the helicopter, the jet), give scrap, set rules, god mode, teleport.
import { useState } from "react";
import { VEHICLES } from "@/game/data/tuning";
import { ADMIN_CARS, ADMIN_PLACES } from "@/game/air/adminActions";

const Btn = ({ onClick, children, on }) => (
  <button onClick={onClick} className={`sw-btn px-3 py-1.5 text-xs ${on ? "sw-btn-primary" : ""}`}>{children}</button>
);
const Row = ({ title, children }) => (
  <div>
    <div className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-[#c9a36a]">{title}</div>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

export default function AdminPanel({ game, onRules, onClose }) {
  const [msg, setMsg] = useState("");
  const [, setTick] = useState(0);
  const A = game.adminActions;
  const done = (r, text) => { setMsg(r === false ? "Not available right now" : r && r.msg !== undefined ? r.msg || text : text); setTick((t) => t + 1); };
  return (
    <div className="pointer-events-auto fixed right-4 top-24 z-40 w-[22rem] max-w-[calc(100vw-2rem)] sw-panel p-4 sw-body text-[#e9dcc4] sw-slide">
      <div className="flex items-center justify-between">
        <div className="sw-display text-xl text-[#f2c230]">ADMIN</div>
        <button onClick={onClose} className="sw-btn px-3 py-1 text-xs">Close · F10</button>
      </div>
      <div className="mt-3 flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
        <Row title="Spawn vehicle">
          {ADMIN_CARS.map((id) => <Btn key={id} onClick={() => done(A.car(id), `Driving a ${VEHICLES[id].name}`)}>{VEHICLES[id].name}</Btn>)}
          <Btn onClick={() => done(A.air("heli"), "Helicopter up")}>Helicopter</Btn>
          <Btn onClick={() => done(A.air("jet"), "Jet on the road")}>Jet</Btn>
          <Btn onClick={() => done(A.wreckframe(), "Wreckframe standing · T to drive")}>Spawn Wreckframe</Btn>
        </Row>
        <Row title="Give banked scrap">
          {[1000, 10000, 50000].map((n) => <Btn key={n} onClick={() => done(A.scrap(n), `+${n} · banked ${game.save.banked}`)}>+{n}</Btn>)}
        </Row>
        <Row title="Rules & cheats">
          <Btn onClick={onRules}>Set rules…</Btn>
          <Btn on={A.godOn()} onClick={() => done(A.god(!A.godOn()), A.godOn() ? "God mode on" : "God mode off")}>God mode {A.godOn() ? "on" : "off"}</Btn>
        </Row>
        <Row title="Teleport">
          {ADMIN_PLACES.map((p) => <Btn key={p.id} onClick={() => done(A.teleport(p.id), `At ${p.name}`)}>{p.name}</Btn>)}
        </Row>
      </div>
      {msg && <div className="mt-3 text-xs text-[#f2c230]">{msg}</div>}
    </div>
  );
}