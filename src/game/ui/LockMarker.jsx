import { useEffect, useRef } from "react";
import { registerLockEls } from "@/game/weapons/lockView";

// Assisted-aim lock marker: brackets on the locked target with its hull bar, distance and the rocket-lock ring,
// plus a dim marker on the next target (Tab). Positioned every render frame by weapons/lockView.js.
const C = "absolute h-3 w-3 border-[color:var(--lk)]";

export default function LockMarker() {
  const main = useRef(null), next = useRef(null);
  useEffect(() => {
    registerLockEls(main.current, next.current);
    return () => registerLockEls(null, null);
  }, []);
  return (
    <>
      <div ref={main} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ display: "none", "--lk": "#ff4a2a" }}>
        <span className={`${C} left-0 top-0 border-l-2 border-t-2`} />
        <span className={`${C} right-0 top-0 border-r-2 border-t-2`} />
        <span className={`${C} bottom-0 left-0 border-b-2 border-l-2`} />
        <span className={`${C} bottom-0 right-0 border-b-2 border-r-2`} />
        <div className="lk-r absolute rounded-full border-2 border-[color:var(--lk)] transition-[inset] duration-100" style={{ display: "none" }} />
        <div className="absolute left-1/2 top-full mt-1 w-20 -translate-x-1/2">
          <div className="h-1 bg-[#0e0c0a]"><div className="lk-hp h-full bg-[color:var(--lk)]" /></div>
        </div>
        <div className="lk-d absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--lk)] drop-shadow-[0_1px_0_#000]" />
      </div>
      <div ref={next} className="absolute -translate-x-1/2 -translate-y-1/2 border border-dashed border-[#f2e6c8] opacity-40" style={{ display: "none" }} />
    </>
  );
}