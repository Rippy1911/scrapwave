// ?debug=1 readout: FPS, frame time, population, player physics state and the test / accel reports.
const yes = (b) => (b ? "✔" : "·");

export default function DebugOverlay({ d }) {
  if (!d) return null;
  const t = d.test, a = d.accel;
  return (
    <div className="pointer-events-none fixed left-4 top-28 z-20 w-64 bg-[rgba(10,8,6,0.78)] border border-[#46413a] px-3 py-2 font-mono text-[11px] leading-5 text-[#cfe9d6]">
      <div className="text-[#f2c230]">{d.fps} fps · {d.ms} ms</div>
      <div>{d.calls} draw calls · {d.ktris}k tris · {d.quality} x{d.ratio}</div>
      <div>vehicles {d.vehicles} · drifters {d.drifters} · rattlers {d.rattlers}</div>
      <div>pos {d.pos}</div>
      <div>grounded {String(d.grounded)} · wheels {d.contacts} · stuck {d.stuck}s</div>
      <div>brain {d.mode}</div>
      <div>fuel {d.fuel}</div>
      {d.demo && d.demo.running && <div>demo {d.demo.segment} · {d.demo.shot} · {d.demo.t}s</div>}
      {d.self && (
        <div className="mt-1 border-t border-[#46413a] pt-1">
          <div className={d.self.pass ? "text-[#7fe0a0]" : d.self.fail ? "text-[#ff4a2a]" : "text-[#f2c230]"}>SELF-CHECK {d.self.pass ? "PASSED" : d.self.fail ? `FAILED ${d.self.note}` : `${d.self.stage} ${d.self.t.toFixed(1)}s`}</div>
          <div>limp {yes(d.self.limp)} · pump {yes(d.self.refill)} · can {yes(d.self.jerry)}</div>
          <div>replay {yes(d.self.replay)} · demo {yes(d.self.demo)} · errors {d.self.errors}</div>
        </div>
      )}
      {t && (
        <div className="mt-1 border-t border-[#46413a] pt-1">
          <div className={t.pass ? "text-[#7fe0a0]" : t.fail ? "text-[#ff4a2a]" : "text-[#f2c230]"}>TEST {t.pass ? `PASSED ${t.at.toFixed(1)}s` : t.fail ? "FAILED" : `${t.t.toFixed(1)}s`}</div>
          <div>jump {yes(t.jumped)} (air {t.bestAir.toFixed(2)}s)</div>
          <div>part off {yes(t.partOff)} · wrecked {yes(t.wrecked)}</div>
        </div>
      )}
      {a && (
        <div className="mt-1 border-t border-[#46413a] pt-1">
          <div className={a.done ? (a.pass ? "text-[#7fe0a0]" : "text-[#ff4a2a]") : "text-[#f2c230]"}>ACCEL {a.done ? (a.pass ? "PASS" : "FAIL") : `run ${a.run} · ${a.t.toFixed(1)}s`}</div>
          <div>W 3 s: {a.v3 || "…"} km/h (need 60)</div>
          <div>W+Shift → 120 km/h: {a.t120 !== null ? `${a.t120}s` : "…"} (need ≤ 6) · 6 s: {a.v6 || "…"}</div>
        </div>
      )}
    </div>
  );
}