// Build view on a touch screen (round 13): the ghost follows your finger and lifting the finger places the piece.
// Mouse input is left alone. click(): place the selected piece or module (the same thing a left click does).
export function buildTouch(game, bv, click) {
  const a = game.input.a;
  let el = null, pending = 0;
  const aim = (e) => { a.mouseX = e.clientX / window.innerWidth; a.mouseY = e.clientY / window.innerHeight; };
  // Cancelling pointerdown stops the browser's follow-up mouse events, so a tap never places twice.
  const down = (e) => { if (!bv.active || e.pointerType === "mouse") return; e.preventDefault(); aim(e); };
  const move = (e) => { if (bv.active && e.pointerType !== "mouse") aim(e); };
  const up = (e) => { if (!bv.active || e.pointerType === "mouse") return; aim(e); pending = 3; };
  return {
    // Once per build-view frame, after the ghost moved. Places a few frames after the finger lifted, so the ghost
    // has settled on the spot even for a quick tap. The canvas is bound on first use (the renderer exists by then).
    frame() {
      if (!el) {
        el = game.rend.renderer.domElement;
        el.style.touchAction = "none";
        el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
      }
      if (pending > 0 && --pending === 0) click();
    },
    dispose() {
      if (!el) return;
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up);
    },
  };
}