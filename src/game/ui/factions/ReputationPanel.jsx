import RepBar from "@/game/ui/factions/RepBar";

// The Reputation panel (map screen and pause menu): every faction's standing and what it means.
export default function ReputationPanel({ rows, compact = false }) {
  if (!rows || !rows.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="sw-display text-lg text-[#f2c230] tracking-wide">REPUTATION</div>
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3"}>
        {rows.map((r) => <RepBar key={r.id} row={r} />)}
      </div>
      {!compact && (
        <div className="text-xs leading-snug text-[#a8987f]">
          Allied traders sell about 20% cheaper, Wary ones dearer, Hostile ones not at all. Hostile militias attack on sight and shut their gates.
        </div>
      )}
    </div>
  );
}