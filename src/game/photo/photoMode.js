// Photo mode (O): a free camera around your car. Drag to look, W A S D to move, Space up, Shift down, Ctrl faster,
// mouse wheel zooms, Enter saves a PNG of the game picture (no HUD, no bar). Single player freezes the world while it
// is open; online the world keeps running and your car sits idle. Listeners exist only while it is open.
import * as THREE from "three";

const REACH = 140; // metres the camera may stray from your car (no scouting the map)

function savePng(el) {
  const a = document.createElement("a");
  a.href = el.toDataURL("image/png");
  a.download = `scrapwake-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
  a.click();
}

export function createPhoto(game) {
  const keys = new Set(), e = new THREE.Euler(0, 0, 0, "YXZ"), move = new THREE.Vector3();
  const st = { on: false, fov: 60, roll: 0, shots: 0 };
  let yaw = 0, pitch = 0, keepFov = 60, drag = null, want = false, wrapped = false;
  const typing = (ev) => ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA");
  const kd = (ev) => { if (typing(ev)) return; keys.add(ev.code); if (ev.code === "Enter") want = true; };
  const ku = (ev) => keys.delete(ev.code);
  const pd = (ev) => { drag = { x: ev.clientX, y: ev.clientY }; };
  const pm = (ev) => {
    if (!drag) return;
    yaw -= (ev.clientX - drag.x) * 0.004;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - (ev.clientY - drag.y) * 0.004));
    drag.x = ev.clientX; drag.y = ev.clientY;
  };
  const pu = () => { drag = null; };
  const wh = (ev) => { st.fov = Math.max(20, Math.min(100, st.fov + Math.sign(ev.deltaY) * 3)); };

  function set(on) {
    if (!!on === st.on || !game.rend) return;
    const cam = game.camera, el = game.rend.renderer.domElement, f = on ? "addEventListener" : "removeEventListener";
    st.on = !!on;
    window[f]("keydown", kd); window[f]("keyup", ku); window[f]("pointermove", pm); window[f]("pointerup", pu);
    el[f]("pointerdown", pd); el[f]("wheel", wh);
    if (on) {
      if (!wrapped) { // the PNG is read straight after a frame is drawn, while the picture is still in the canvas
        wrapped = true;
        const render = game.rend.render;
        game.rend.render = () => { render(); if (want) { want = false; if (st.on) { savePng(el); st.shots++; } } };
      }
      e.setFromQuaternion(cam.quaternion, "YXZ");
      yaw = e.y; pitch = e.x; keepFov = cam.fov; st.fov = Math.round(cam.fov); st.roll = 0;
    } else {
      keys.clear(); drag = null; want = false;
      cam.fov = keepFov; cam.updateProjectionMatrix();
      game.cam.snap(game.player);
    }
  }

  // Per render frame, before the other cameras. Returns true while photo mode owns the camera.
  function frame(real) {
    if (!st.on) return false;
    const cam = game.camera, k = (...c) => (c.some((x) => keys.has(x)) ? 1 : 0);
    const sp = (keys.has("ControlLeft") ? 40 : 14) * Math.min(real, 0.05);
    cam.quaternion.setFromEuler(e.set(pitch, yaw, st.roll));
    move.set(k("KeyD", "ArrowRight") - k("KeyA", "ArrowLeft"), 0, k("KeyS", "ArrowDown") - k("KeyW", "ArrowUp")).applyQuaternion(cam.quaternion).multiplyScalar(sp);
    move.y += (k("Space", "KeyE") - k("ShiftLeft", "ShiftRight", "KeyQ")) * sp;
    cam.position.add(move);
    const p = game.player.pos;
    move.copy(cam.position).sub(p);
    if (move.length() > REACH) cam.position.copy(p).add(move.setLength(REACH));
    cam.position.y = Math.max(cam.position.y, game.world.terrain.heightAt(cam.position.x, cam.position.z) + 0.5);
    if (cam.fov !== st.fov) { cam.fov = st.fov; cam.updateProjectionMatrix(); }
    return true;
  }

  return {
    state: st, set, frame,
    active: () => st.on,
    shot() { want = true; },
    hold(code, on) { if (on) keys.add(code); else keys.delete(code); }, // on-screen move buttons
  };
}