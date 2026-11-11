const DOT = { online: "bg-[#7fe0a0]", reconnecting: "bg-[#f2c230] sw-pulse", offline: "bg-[#8a7d6a]" };

// Connection status: offline / online (shard, drivers, ping, host) / reconnecting.
export default function NetPill({ net }) {
  if (!net) return null;
  return (
    <div className="flex w-fit items-center gap-2 rounded-sm bg-[rgba(18,14,10,0.6)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#d8cbb2]">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[net.state] || DOT.offline}`} />
      {net.label}
    </div>
  );
}