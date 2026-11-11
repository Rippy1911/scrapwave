import { useEffect, useRef } from "react";

// The empty right side: a swipe turns the camera (chase cam or on-foot cam), like mouse look.
const SENS = 1.6;

export default function LookPad({ tc }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    let id = null, lx = 0, ly = 0;
    const down = (e) => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId; lx = e.clientX; ly = e.clientY;
      el.setPointerCapture?.(id);
    };
    const move = (e) => {
      if (e.pointerId !== id) return;
      e.preventDefault();
      tc.look((e.clientX - lx) * SENS, (e.clientY - ly) * SENS);
      lx = e.clientX; ly = e.clientY;
    };
    const up = (e) => { if (e.pointerId === id) id = null; };
    el.addEventListener("pointerdown", down, { passive: false });
    el.addEventListener("pointermove", move, { passive: false });
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
    };
  }, [tc]);
  return <div ref={ref} className="sw-tc-look" />;
}