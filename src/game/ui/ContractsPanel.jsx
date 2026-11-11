import { useState } from "react";
import { contractList, rerollContract, ensureContracts } from "@/game/base/contracts";

// Garage: today's three contracts with progress bars and the one free reroll.
export default function ContractsPanel({ save }) {
  const [, force] = useState(0);
  const list = contractList(save), rerolled = ensureContracts(save).rerolled;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-[#c9a36a]">
        <span>Daily contracts</span><span className="text-[#a8987f]">{rerolled ? "reroll used" : "1 free reroll"}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {list.map((c, i) => (
          <div key={c.id} className={`bg-[#141210] px-3 py-2 ${c.done ? "border-l-4 border-[#7fe0a0]" : ""}`}>
            <div className="text-sm font-bold text-[#f4ead6]">{c.text}</div>
            <div className="mt-1 h-1.5 bg-[#0e0c0a]"><div className="h-full bg-[#f2c230]" style={{ width: `${(c.progress / c.goal) * 100}%` }} /></div>
            <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.15em]">
              <span className="text-[#a8987f]">{c.progress} / {c.goal}</span>
              <span className={c.done ? "text-[#7fe0a0]" : "text-[#f2c230]"}>{c.done ? "paid" : `${c.reward} scrap`}</span>
            </div>
            {!c.done && !rerolled && <button onClick={() => { rerollContract(save, i); force((x) => x + 1); }} className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9cc8ff] underline decoration-dotted">Reroll</button>}
          </div>
        ))}
      </div>
    </div>
  );
}