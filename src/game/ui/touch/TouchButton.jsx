import { useEffect, useRef } from "react";

// One round touch button. Press / release go straight to the touch controller (multi-touch safe: each button
// follows its own pointer). Pointer events are default-prevented so no emulated mouse click ever fires the guns.
export default function TouchButton({ tc, action, label, kind = "", style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    let id = null;
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (id !== null) return;
      id = e.pointerId;
      el.setPointerCapture?.(id);
      el.classList.add("is-down");
      tc.press(action);
    };
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      el.classList.remove("is-down");
      tc.release(action);
    };
    const stop = (e) => e.preventDefault();
    el.addEventListener("pointerdown", down, { passive: false });
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("contextmenu", stop);
    return () => {
      tc.release(action);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      el.removeEventListener("contextmenu", stop);
    };
  }, [tc, action]);
  return (
    <div ref={ref} role="button" aria-label={label} className={`sw-tc-btn ${kind}`} style={style}>
      {label}
    </div>
  );
}