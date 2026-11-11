// Single requestAnimationFrame loop with a fixed 60 Hz simulation and interpolated rendering.
import { PHYSICS } from "@/game/data/tuning";

// speed: 1 always in play; only the ?mechcheck=1 script runs the simulation faster to finish within a short capture.
export function createLoop({ step, frame, speed = 1 }) {
  const dt = 1 / PHYSICS.hz;
  const loop = {
    running: false, paused: false, // time always runs at 1x: no slow motion, no hit-stop
    acc: 0, last: 0, raf: 0, simTime: 0, frameMs: 16,
  };
  function tick(now) {
    if (!loop.running) return;
    loop.raf = requestAnimationFrame(tick);
    let real = (now - loop.last) / 1000;
    loop.last = now;
    if (real > PHYSICS.maxFrameDt * speed) real = PHYSICS.maxFrameDt * speed; // tab switch clamp
    if (real < 0) real = 0;
    loop.frameMs = loop.frameMs * 0.9 + real * 1000 * 0.1;
    if (!loop.paused) {
      loop.acc += real * speed;
      let n = 0;
      while (loop.acc >= dt && n < PHYSICS.maxSteps * speed) {
        step(dt);
        loop.simTime += dt;
        loop.acc -= dt;
        n++;
      }
      if (n >= PHYSICS.maxSteps * speed) loop.acc = 0;
    }
    frame(loop.paused ? 1 : loop.acc / dt, real);
  }
  loop.start = () => {
    if (loop.running) return;
    loop.running = true;
    loop.last = performance.now();
    loop.raf = requestAnimationFrame(tick);
  };
  loop.stop = () => { loop.running = false; cancelAnimationFrame(loop.raf); };
  return loop;
}