import { Check, Crown, WifiOff } from "lucide-react";
import { rideName } from "@/game/lobby/rideRules";

const tag = "text-[10px] uppercase tracking-[0.2em]";

// The lobby's players: host crown, ready state, chosen ride; dropped players keep their seat for a while.
export default function PlayerList({ lobby, me }) {
  return (
    <div className="flex flex-col">
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">
        <span>Players</span><span>{lobby.players.filter((p) => !p.dropped).length}/{lobby.max}</span>
      </div>
      {lobby.players.map((p) => {
        const host = p.id === lobby.hostId;
        return (
          <div key={p.id} className={`flex items-center gap-2 border-t border-[#3a362f] py-1.5 ${p.dropped ? "opacity-50" : ""}`}>
            <div className="w-4">{host && <Crown className="h-3.5 w-3.5 text-[#f2c230]" />}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate sw-display text-sm text-[#eadfc8]">{p.name}{p.id === me && <span className="ml-1.5 text-[10px] text-[#a8987f]">YOU</span>}</div>
              <div className="truncate text-[11px] text-[#7d7262]">{rideName(p.ride)}{p.ride ? ` · tier ${p.ride.tier}` : ""}</div>
            </div>
            {p.dropped ? <span className={`flex items-center gap-1 ${tag} text-[#ff8a6a]`}><WifiOff className="h-3 w-3" />Dropped</span>
              : host ? <span className={`${tag} text-[#f2c230]`}>Host</span>
              : p.ready ? <span className={`flex items-center gap-1 ${tag} text-[#7fe0a0]`}><Check className="h-3 w-3" />Ready</span>
              : <span className={`${tag} text-[#a8987f]`}>Not ready</span>}
          </div>
        );
      })}
    </div>
  );
}