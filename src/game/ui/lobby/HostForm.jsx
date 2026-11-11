import { useState } from "react";
import { randomCode } from "@/game/lobby/lobbyState";
import { describeRules } from "@/game/lobby/describe";

const field = "bg-[#141210] border border-[#57503f] px-2 py-1.5 text-sm text-[#f4ead6] w-full";
const label = "text-[10px] uppercase tracking-[0.25em] text-[#a8987f]";

// Host a lobby: the Custom Game rules become a lobby with a name, a player limit and an optional join code.
export default function HostForm({ rules, driver, busy, error, onHost, onBack }) {
  const [name, setName] = useState(`${driver || "Driver"}'s ${rules.name}`);
  const [max, setMax] = useState(4);
  const [code, setCode] = useState("");
  const d = describeRules(rules);
  return (
    <div className="sw-panel sw-slide w-full max-w-md px-6 py-5 flex flex-col gap-4">
      <div>
        <div className="sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#5a1e08]">HOST A LOBBY</div>
        <div className="text-sm text-[#a8987f]">{d.mode} · {d.map}</div>
      </div>
      <label className="flex flex-col gap-1"><span className={label}>Lobby name</span>
        <input value={name} maxLength={28} onChange={(e) => setName(e.target.value)} className={field} />
      </label>
      <div className="flex flex-col gap-1"><span className={label}>Players</span>
        <div className="flex gap-1.5">
          {[2, 3, 4, 6, 8].map((n) => (
            <button key={n} onClick={() => setMax(n)} className={`flex-1 py-1.5 sw-display text-sm border ${max === n ? "bg-[#3a3122] text-[#f2c230] border-[#8a6a1e]" : "bg-[#141210] text-[#a8987f] border-[#3a362f]"}`}>{n}</button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1"><span className={label}>Join code (optional)</span>
        <div className="flex gap-2">
          <input value={code} maxLength={6} placeholder="Open to all" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className={`${field} sw-display tracking-[0.3em]`} />
          <button onClick={() => setCode(randomCode())} className="sw-btn px-3 text-xs">Random</button>
        </div>
      </label>
      {error && <div className="text-sm text-[#ff8a6a]">{error}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={onBack} className="sw-btn px-4 py-2 text-sm">Back</button>
        <button disabled={!!busy} onClick={() => onHost({ name, max, code })} className="sw-btn sw-btn-primary px-6 py-2 text-sm disabled:opacity-50">{busy || "Host"}</button>
      </div>
    </div>
  );
}