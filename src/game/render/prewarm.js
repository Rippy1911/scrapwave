// Shader pre-warm, once at boot behind the loading screen. Without it the first explosion of a session stalled one
// frame by about 280 ms (RESULT.md): a wreck switches the car's paint to its burnt, unmapped variant, and the blast
// pools (fireball cores, shock rings), pickup glows, goo splats and turbo flames stay hidden until first use, so their
// programs were linked mid-game.
// Why the old renderer.compile(scene, camera) missed them: the scene is drawn into the post chain's half-float target,
// and three keys tone mapping and output colour space on the render target, so programs compiled for the screen are
// never used. Here every material compiles with that target bound (compileAsync where the driver compiles in
// parallel), then one off-screen render at 256x144 draws the explosion, muzzle flash, smoke, fire, sparks, a tracer,
// a scrap glow and every hidden effect mesh, which also builds the shadow-depth programs. All of it is undone after.
import * as THREE from "three";

const MESHY = (o) => o.isMesh || o.isPoints || o.isLine || o.isSprite;

export async function prewarm(game) {
  const { renderer, composer } = game.rend, { scene, camera } = game;
  const t0 = performance.now();
  const undo = [];
  const report = { ms: 0, programsBefore: renderer.info.programs?.length ?? 0, programsAfter: 0, error: null };
  const small = new THREE.WebGLRenderTarget(256, 144, { type: THREE.HalfFloatType });
  const prevTarget = renderer.getRenderTarget();
  try {
    // 1. Effects in front of the camera: they are pooled, so they are compiled and drawn once, then retired.
    camera.updateMatrixWorld();
    const d = camera.getWorldDirection(new THREE.Vector3()), at = camera.position.clone().addScaledVector(d, 20);
    const P = game.particles, x = at.x, y = at.y, z = at.z;
    P.explosion(x, y, z, 1.3); P.muzzle(x, y, z); P.smoke(x, y, z, true); P.smoke(x, y, z, false); P.fire(x, y, z);
    P.sparks(x, y, z, 6); P.trail(x, y, z); P.turbo(x, y, z); P.dust(x, y, z);
    game.fx.flash(x, y, z); game.fx.tracer(camera.position.clone(), at);
    const before = game.pickups.list.length;
    game.pickups.spawn(x, y, z, 0);
    const glow = game.pickups.list.slice(before);
    undo.push(() => { for (const p of glow) game.pickups.take(p); });

    // 2. Wrecked paint: wreckVehicle() drops the paint map, which is a different program.
    const paints = new Set();
    for (const v of game.vehicles) { const m = v.mesh && v.mesh.paintMat; if (m && m.map) paints.add(m); }
    for (const m of paints) {
      const map = m.map;
      m.map = null; m.needsUpdate = true;
      undo.push(() => { m.map = map; m.needsUpdate = true; });
    }

    // 3. Hidden effect meshes (blast cores and rings, goo splats, flames) drawn for this one frame.
    scene.traverse((o) => { if (MESHY(o) && !o.visible) { o.visible = true; undo.push(() => { o.visible = false; }); } });

    // 4. Compile for the post chain's target, then draw once off-screen.
    renderer.setRenderTarget(composer.inputBuffer);
    if (renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 6000))]);
    else renderer.compile(scene, camera);
    renderer.setRenderTarget(small);
    renderer.render(scene, camera);
  } catch (e) {
    report.error = String((e && e.message) || e).slice(0, 120);
  } finally {
    renderer.setRenderTarget(prevTarget);
    for (let i = undo.length - 1; i >= 0; i--) { try { undo[i](); } catch { /* keep undoing */ } }
    try { game.particles.update(60); game.fx.update(60, camera.position); } catch { /* retired on the next frames anyway */ }
    small.dispose();
    report.programsAfter = renderer.info.programs?.length ?? 0;
    report.ms = Math.round(performance.now() - t0);
  }
  return report;
}
