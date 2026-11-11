// Sampled engine (round 14): the pack's six seamless loops run from low revs to high. All six play at once; the two
// nearest the current revs are mixed, and each is pitched by how far the revs are from its own band, so the note
// climbs smoothly. set() answers false until the loops are decoded, and audio.js keeps its synth engine till then.
import { sound } from "@/game/assets/cdnPack";
import { decodeAll } from "@/game/audio/samples";

const PITCH = { diesel: 0.72, burble: 0.86 }; // heavy engines sit lower

export function createEngineLoops() {
  let ctx = null, voices = null;
  return {
    attach(c, out) {
      ctx = c;
      sound("engineLoops").then((list) => decodeAll(c, list)).then((bufs) => {
        if (ctx !== c || bufs.length < 2) return;
        voices = bufs.map((buffer) => {
          const src = c.createBufferSource(), g = c.createGain();
          src.buffer = buffer; src.loop = true; g.gain.value = 0;
          src.connect(g); g.connect(out);
          src.start();
          return { src, g };
        });
      });
    },
    // rpm 0..1, load 0..1.5 (throttle, plus turbo), sound: the chassis engine type, on: the engine is running.
    set(rpm, load, sound, on) {
      if (!voices) return false;
      const t = ctx.currentTime, x = Math.max(0, Math.min(1, rpm)) * (voices.length - 1);
      const base = PITCH[sound] || 1, level = on ? 0.2 + load * 0.12 : 0;
      voices.forEach((v, i) => {
        v.g.gain.setTargetAtTime(Math.max(0, 1 - Math.abs(x - i)) * level, t, 0.06);
        v.src.playbackRate.setTargetAtTime(base * (1 + (x - i) * 0.14), t, 0.06);
      });
      return true;
    },
    ready: () => !!voices,
    dispose() { if (voices) for (const v of voices) v.src.stop(); voices = null; ctx = null; },
  };
}