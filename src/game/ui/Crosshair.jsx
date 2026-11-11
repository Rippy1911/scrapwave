import { useEffect, useRef } from "react";

// Crosshair: fixed above centre with pointer lock; follows the mouse when the pointer is free.
export default function Crosshair({ lock, hitRecent, free }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!free) { el.style.left = "50%"; el.style.top = "var(--sw-cross-y, 44%)"; return; } // climbs as the aim goes above the horizon
    const mm = (e) => { el.style.left = `${e.clientX}px`; el.style.top = `${e.clientY}px`; };
    window.addEventListener("mousemove", mm);
    return () => window.removeEventListener("mousemove", mm);
  }, [free]);
  const c = lock ? "bg-[#ff4a2a]" : "bg-[#f2e6c8]";
  return (
    <div ref={ref} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: "var(--sw-cross-y, 44%)" }}>
      <div className={`relative h-8 w-8 transition-transform ${lock ? "scale-125" : ""}`}>
        <div className={`absolute left-1/2 top-0 h-2.5 w-[2px] -translate-x-1/2 ${c}`} />
        <div className={`absolute left-1/2 bottom-0 h-2.5 w-[2px] -translate-x-1/2 ${c}`} />
        <div className={`absolute top-1/2 left-0 w-2.5 h-[2px] -translate-y-1/2 ${c}`} />
        <div className={`absolute top-1/2 right-0 w-2.5 h-[2px] -translate-y-1/2 ${c}`} />
        {hitRecent && <div className="absolute inset-[-6px] rotate-45 border-2 border-[#ffd54a]" />}
      </div>
    </div>
  );
}