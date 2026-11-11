import { useEffect, useRef } from "react";

// Floating left thumb stick: the base jumps to where the thumb lands inside the stick zone and returns to its rest
// spot on release. Writes x / y (-1..1, y + = forward) straight to the touch controller, no React state per move.
export default function TouchStick({ tc, scale = 1, left = false }) {
  const zone = useRef(null), base = useRef(null), knob = useRef(null);
  useEffect(() => {
    const z = zone.current, b = base.current, k = knob.current;
    const R = 52 * scale;
    let id = null, cx = 0, cy = 0;
    const rest = () => {
      const r = z.getBoundingClientRect();
      const off = 30 + 64 * scale;
      cx = left ? r.width - off : off; cy = r.height - off + 6;
      b.style.left = `${cx}px`; b.style.top = `${cy}px`; k.style.transform = "translate(0px,0px)";
      b.classList.add("is-idle");
    };
    const move = (e) => {
      const r = z.getBoundingClientRect();
      let dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
      const m = Math.hypot(dx, dy);
      if (m > R) { dx *= R / m; dy *= R / m; }
      k.style.transform = `translate(${dx}px,${dy}px)`;
      tc.stick(dx / R, -dy / R);
    };
    const down = (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      z.setPointerCapture?.(id);
      const r = z.getBoundingClientRect();
      cx = e.clientX - r.left; cy = e.clientY - r.top;
      b.style.left = `${cx}px`; b.style.top = `${cy}px`; b.classList.remove("is-idle");
      move(e);
    };
    const mv = (e) => { if (e.pointerId === id) { e.preventDefault(); move(e); } };
    const up = (e) => { if (e.pointerId !== id) return; id = null; tc.stick(0, 0); rest(); };
    rest();
    z.addEventListener("pointerdown", down, { passive: false });
    z.addEventListener("pointermove", mv, { passive: false });
    z.addEventListener("pointerup", up); z.addEventListener("pointercancel", up);
    window.addEventListener("resize", rest);
    return () => {
      tc.stick(0, 0);
      z.removeEventListener("pointerdown", down); z.removeEventListener("pointermove", mv);
      z.removeEventListener("pointerup", up); z.removeEventListener("pointercancel", up);
      window.removeEventListener("resize", rest);
    };
  }, [tc, scale, left]);
  return (
    <div ref={zone} className="sw-tc-stickzone" style={{ "--ss": scale }}>
      <div ref={base} className="sw-tc-base is-idle"><div ref={knob} className="sw-tc-knob" /></div>
    </div>
  );
}