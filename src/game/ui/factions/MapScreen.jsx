import { useEffect, useState } from "react";
import WorldMap from "@/game/ui/factions/WorldMap";
import ReputationPanel from "@/game/ui/factions/ReputationPanel";
import { FACTIONS } from "@/game/factions/roster";

// The map screen (M): the world map with faction territories, and the Reputation panel.
export default function MapScreen({ game, online, onClose }) {
  const read = () => { const f = game.onfoot.hud(); return { rows: game.factions.all(), p: { x: f.x, z: f.z }, yaw: -(game.cam.yaw + game.cam.orbitYaw) }; };
  const [st, setSt] = useState(read);
  useEffect(() => { const t = setInterval(() => setSt(read()), 500); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(10,7,5,0.75)] sw-body text-[#e9dcc4] p-4">
      <div className="sw-panel w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 flex flex-col gap-4 sw-slide">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="sw-display text-3xl text-[#f2c230]">THE SALTREACH</h2>
            {online && <div className="text-xs uppercase tracking-[0.2em] text-[#ff8a6a]">Online · the world keeps moving</div>}
          </div>
          <button onClick={onClose} className="sw-btn sw-btn-primary px-5 py-1.5 text-sm">Close (M)</button>
        </div>
        <div className="flex flex-col md:flex-row gap-5">
          <div className="flex-1 flex flex-col gap-2">
            <WorldMap px={st.p.x} pz={st.p.z} yaw={st.yaw} />
            <div className="flex flex-wrap gap-3 text-xs">
              {FACTIONS.filter((f) => f.home).map((f) => <span key={f.id} style={{ color: f.color }}>● {f.name}</span>)}
            </div>
          </div>
          <div className="md:w-72"><ReputationPanel rows={st.rows} /></div>
        </div>
      </div>
    </div>
  );
}