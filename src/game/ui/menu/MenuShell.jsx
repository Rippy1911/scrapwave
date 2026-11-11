// The frame every pause, results and arena menu shares: a pinned top bar (title on the left, the buttons that must
// always be reachable on the right) and a middle that scrolls. The panel never grows taller than the screen, so
// Resume, Leave and Settings stay in reach at 1280x720, 1920x1080 and on an 844x390 phone.
export default function MenuShell({ title, sub, tone = "text-[#f2c230]", actions, children, wide = false, backdrop = "bg-[rgba(10,7,5,0.72)]", z = "z-30" }) {
  return (
    <div className={`fixed inset-0 ${z} flex items-center justify-center ${backdrop} p-2 sw-body text-[#e9dcc4] md:p-4`}>
      <div className={`sw-panel sw-slide flex max-h-[calc(100dvh-1rem)] w-full flex-col ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-[#46413a] px-4 py-2.5 md:px-6">
          <div className="min-w-0">
            <h2 className={`sw-display text-2xl leading-tight md:text-4xl ${tone}`}>{title}</h2>
            {sub && <div className="truncate text-[10px] uppercase tracking-[0.2em] text-[#a8987f] md:text-xs">{sub}</div>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-3 md:px-6 md:py-4" data-menu-scroll>
          {children}
        </div>
      </div>
    </div>
  );
}