const NEED = { neutral: "Neutral", friendly: "Friendly", allied: "Allied" };

// A faction's job board: every job it posts, locked ones show the standing they need.
export default function JobBoard({ view, onTake }) {
  if (!view.board.length) return <div className="py-6 text-center text-sm text-[#a8987f]">No jobs posted here.</div>;
  return (
    <div className="flex flex-col gap-2">
      {view.boardFull && <div className="text-xs uppercase tracking-[0.18em] text-[#ffcf7a]">You already have the most jobs you can run</div>}
      {view.board.map((j) => {
        const why = j.taken ? "Running" : j.locked ? `Needs ${NEED[j.need] || j.need}` : j.noConvoy ? "No convoy out" : null;
        return (
          <div key={j.kind} className="flex items-center gap-3 border-t border-[#3a362f] pt-2">
            <div className="flex-1">
              <div className="sw-display text-sm text-[#eadfc8]">{j.title}{j.rival && <span className="ml-2 text-[10px] text-[#ff8a6a]">ANGERS {String(j.rival).toUpperCase()}</span>}</div>
              <div className="text-xs text-[#a8987f]">{j.from} · {j.reward} scrap</div>
            </div>
            <button disabled={!!why || view.boardFull} onClick={() => onTake(j.kind)} className="sw-btn sw-btn-primary px-3 py-1 text-xs disabled:opacity-30">{why || "Take"}</button>
          </div>
        );
      })}
    </div>
  );
}