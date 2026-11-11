import { MAP_KINDS } from "@/game/maps/catalog";
import MapPicture from "@/game/ui/play/MapPicture";

// The short loading screen in front of a world map while it is built (ui/play/useMapLoading.js).
export default function MapLoading({ map }) {
  if (!map) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0c0b] sw-body">
      <div className="w-[min(560px,92vw)] sw-panel sw-slide p-5">
        <div className="sw-hazard -mx-5 -mt-5 mb-4 h-2" />
        <div className="text-xs uppercase tracking-[0.3em] text-[#c9a36a]">{MAP_KINDS[map.kind]} · Loading</div>
        <div className="sw-display text-3xl text-[#f2c230]">{map.name}</div>
        <MapPicture id={map.id} className="mt-3" />
        <p className="mt-3 text-sm text-[#e9dcc4]">{map.blurb}</p>
        {map.landmark && <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[#a8987f]">Landmark · {map.landmark}</p>}
        <div className="relative mt-4 h-2 overflow-hidden rounded-sm bg-[#26231f]"><div className="absolute inset-y-0 w-1/4 bg-[#f2c230] sw-fill" /></div>
        {map.tip && <p className="mt-2 text-xs text-[#a8987f]">{map.tip}</p>}
      </div>
    </div>
  );
}