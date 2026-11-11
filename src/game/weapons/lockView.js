// Screen-space lock marker, moved every render frame (the React HUD only updates 10x a second).
// ui/LockMarker.jsx registers its two elements here; playerAim.js calls drawLock after the camera moves.
import * as THREE from "three";

const els = { main: null, next: null };
const p = new THREE.Vector3();

export function registerLockEls(main, next) { els.main = main; els.next = next; }

function place(el, c, dist, camera) {
  p.copy(c.pos).project(camera);
  if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) { el.style.display = "none"; return false; }
  const size = Math.max(26, Math.min(96, 1100 / Math.max(1, dist)));
  el.style.display = "block";
  el.style.left = `${((p.x + 1) / 2) * window.innerWidth}px`;
  el.style.top = `${((1 - p.y) / 2) * window.innerHeight}px`;
  el.style.width = el.style.height = `${size}px`;
  return true;
}

// st: aim assist state; rocketK: 0..1 rocket lock progress (null = no rockets fitted).
export function drawLock(camera, st, rocketK) {
  const { main, next } = els;
  if (!main || !next) return;
  if (!st || !st.lock) { main.style.display = "none"; next.style.display = "none"; return; }
  const { c, dist } = st.lock;
  if (place(main, c, dist, camera)) {
    main.style.setProperty("--lk", !st.inRange ? "#8f8a80" : rocketK >= 1 ? "#ffd54a" : "#ff4a2a");
    const hp = main.querySelector(".lk-hp"), d = main.querySelector(".lk-d"), r = main.querySelector(".lk-r");
    hp.style.width = `${Math.max(0, Math.min(1, c.maxHull ? c.hull / c.maxHull : 1)) * 100}%`;
    hp.parentElement.style.display = c.kind === "figure" || c.kind === "barrel" ? "none" : "block";
    d.textContent = `${c.name ? c.name + " · " : ""}${Math.round(dist)} m${st.inRange ? "" : " · OUT OF RANGE"}`;
    r.style.display = rocketK === null || !st.inRange ? "none" : "block";
    r.style.inset = `${-12 * (1 - Math.min(1, rocketK || 0))}px`;
    r.style.opacity = rocketK >= 1 ? "1" : "0.6";
  }
  if (st.next) place(next, st.next.c, st.next.dist, camera);
  else next.style.display = "none";
}