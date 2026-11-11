// Sampled one-shots (round 14): the hosted sound pack (assets/cdnPack.js), decoded with the game's AudioContext.
// play() answers false until a key's samples are ready (or if they never arrive), and audio.js then plays its
// synthesized sound instead.
import { sound, soundKeys } from "@/game/assets/cdnPack";

// Raw bytes -> AudioBuffers. A file that will not decode is left out.
export function decodeAll(ctx, list) {
  return Promise.all(list.map((bytes) => new Promise((resolve) => {
    const p = ctx.decodeAudioData(bytes, resolve, () => resolve(null));
    if (p && p.catch) p.catch(() => resolve(null));
  }))).then((bufs) => bufs.filter(Boolean));
}

export function createSamples() {
  let ctx = null, bus = null;
  const bufs = {};
  return {
    // Once the AudioContext exists: fetch and decode every key (the whole pack is under 1 MB).
    attach(c, out) {
      ctx = c; bus = out;
      soundKeys().then((keys) => {
        for (const key of keys) sound(key).then((list) => decodeAll(c, list)).then((ok) => { if (ok.length && ctx === c) bufs[key] = ok; });
      });
    },
    // One of the key's samples at random, pitch varied by 6 percent. true: handled (played, or too quiet to hear).
    play(key, gain = 1, rate = 1) {
      const list = ctx && bufs[key];
      if (!list) return false;
      if (gain < 0.01) return true;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = list[Math.floor(Math.random() * list.length)];
      src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
      g.gain.value = gain;
      src.connect(g); g.connect(bus);
      src.start();
      return true;
    },
    keys: () => Object.keys(bufs),
  };
}