// A radio message strip (low fuel, empty tank) above the bottom-left panel.
export default function RadioLine({ radio }) {
  if (!radio) return null;
  return (
    <div key={radio.id} className="sw-hud-radio pointer-events-none fixed left-4 bottom-[150px] md:bottom-[170px] w-72 md:w-96 sw-panel sw-slide px-4 py-2 sw-body">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#9cc8ff]">
        <span className="inline-block h-2 w-2 rounded-full bg-[#9cc8ff] sw-pulse" />{radio.from}
      </div>
      <div className="mt-1 text-sm leading-snug text-[#e9dcc4]">"{radio.text}"</div>
    </div>
  );
}