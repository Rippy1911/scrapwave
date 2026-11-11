// Shown while the room server connection is being made (falls back to solo after 6 s).
export default function ConnectingCard() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(10,7,5,0.7)] sw-body text-[#e9dcc4]">
      <div className="sw-panel w-72 px-6 py-5 text-center">
        <div className="sw-display text-xl tracking-widest text-[#f2c230]">CONNECTING</div>
        <div className="mt-1 text-xs uppercase tracking-[0.25em] text-[#a8987f]">Finding a seat in the Saltreach</div>
        <div className="relative mt-4 h-2 overflow-hidden bg-[#0e0c0a]"><div className="absolute top-0 h-full w-1/4 bg-[#f2c230] sw-fill" /></div>
      </div>
    </div>
  );
}