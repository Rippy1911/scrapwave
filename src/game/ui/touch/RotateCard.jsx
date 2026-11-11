import { RotateCw } from "lucide-react";
import "@/game/ui/touch/touch.css";

// Shown by CSS only in portrait while touch controls are on (see .sw-rotate in touch.css).
export default function RotateCard() {
  return (
    <div className="sw-rotate sw-body">
      <RotateCw className="h-14 w-14 text-[#f2c230] sw-pulse" />
      <div className="sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#000]">ROTATE YOUR PHONE</div>
      <div className="max-w-xs text-sm uppercase tracking-[0.2em] text-[#c9b89a]">Scrapwave plays in landscape. Turn your device sideways to drive.</div>
    </div>
  );
}