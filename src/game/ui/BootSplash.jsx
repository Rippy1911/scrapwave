import { GAME_TITLE } from "@/game/data/tuning";

// Server-rendered placeholder shown until the client-only game bundle mounts.
export default function BootSplash({ progress = 0.15, tip = "Warming up the engine..." }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#14110e] text-[#e9dcc4] select-none">
      <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(ellipse at 50% 70%, #6b2d10 0%, #1d1510 55%, #0b0907 100%)" }} />
      <div className="relative flex flex-col items-center gap-8 px-6">
        <h1 className="sw-display text-6xl md:text-8xl tracking-wider text-[#f2c230] drop-shadow-[0_4px_0_#5a1e08]">
          {GAME_TITLE.toUpperCase()}
        </h1>
        <div className="w-72 md:w-96">
          <div className="flex justify-between text-[11px] uppercase tracking-[0.3em] text-[#c9a36a] mb-2">
            <span>E</span><span>Fuel</span><span>F</span>
          </div>
          <div className="h-4 rounded-sm border-2 border-[#5c5348] bg-[#0e0c0a] p-[2px]">
            <div className="h-full rounded-[1px] bg-gradient-to-r from-[#b8440f] via-[#e07a1c] to-[#f2c230] transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
        <p className="sw-body text-sm tracking-wide text-[#a8987f]">{tip}</p>
      </div>
    </div>
  );
}