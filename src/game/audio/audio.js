// Procedural WebAudio: engine voice, guns, explosions, impacts, pickups and a driving drum loop. Buses: music, sfx, voice.
// Round 14: one-shots and the engine use the hosted samples when they have loaded (audio/samples.js,
// audio/engineLoops.js); every synthesized sound below stays as the fallback.
import { loadPack } from "@/game/assets/cdnPack";
import { createSamples } from "@/game/audio/samples";
import { createEngineLoops } from "@/game/audio/engineLoops";

export function createAudio() {
  let ctx = null, master, buses = {}, noiseBuf, engine = null, music = null, listener = { x: 0, y: 0, z: 0 };
  const samples = createSamples(), loops = createEngineLoops();
  let boosting = false, boostAt = 0;
  loadPack(); // the hosted pack's manifest: one fetch at boot
  const vol = { master: 0.8, music: 0.45, sfx: 0.9 };

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol.master;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    for (const b of ["music", "sfx", "voice"]) { buses[b] = ctx.createGain(); buses[b].gain.value = vol[b] ?? 1; buses[b].connect(master); }
    samples.attach(ctx, buses.sfx); loops.attach(ctx, buses.sfx);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startEngine(); startMusic();
  }

  const att = (p) => { if (!p) return 1; const d = Math.hypot(p.x - listener.x, p.y - listener.y, p.z - listener.z); return Math.max(0, 1 - d / 260) ** 1.6; };

  function noise(dur, freq, q, gain, type = "lowpass", sweep = 0) {
    if (!ctx || gain < 0.01) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(buses.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, gain, type = "square", slide = 1, bus = "sfx", delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(buses[bus]); o.start(t); o.stop(t + dur + 0.05);
  }

  function startEngine() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = "sawtooth"; o2.type = "square";
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600; f.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(buses.sfx);
    o1.start(); o2.start();
    engine = { o1, o2, f, g };
  }

  function startMusic() {
    const bpm = 112, beat = 60 / bpm;
    let next = ctx.currentTime + 0.1, step = 0;
    const bass = [55, 55, 65.4, 55, 49, 49, 58.3, 49];
    music = setInterval(() => {
      if (!ctx || ctx.state !== "running") return;
      while (next < ctx.currentTime + 0.3) {
        const t = next - ctx.currentTime;
        if (step % 4 === 0) kick(t);
        if (step % 4 === 2) snare(t);
        hat(t);
        if (step % 2 === 0) tone(bass[(step / 2) % 8], beat * 0.9, 0.12, "sawtooth", 1, "music", t);
        next += beat / 2; step = (step + 1) % 64;
      }
    }, 100);
  }
  function kick(delay) { tone(110, 0.3, 0.55, "sine", 0.35, "music", delay); }
  function snare(delay) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f); f.connect(g); g.connect(buses.music); src.start(t); src.stop(t + 0.2);
  }
  function hat(delay) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(buses.music); src.start(t); src.stop(t + 0.06);
  }

  return {
    init,
    setListener(p) { listener = p; },
    setVolume(k, v) { vol[k] = v; if (!ctx) return; if (k === "master") master.gain.value = v; else if (buses[k]) buses[k].gain.value = v; },
    vol,
    engine(rpm, load, sound, on) {
      if (!engine) return;
      const base = sound === "diesel" ? 32 : sound === "burble" ? 42 : 55;
      const f = base + rpm * base * 2.6;
      const t = ctx.currentTime;
      const boost = on && load > 1.05; // load above 1 means the turbo is burning
      if (boost && !boosting && t - boostAt > 2.5) { boostAt = t; samples.play("accelerate", 0.35); }
      boosting = boost;
      if (loops.set(rpm, load, sound, on)) { engine.g.gain.setTargetAtTime(0, t, 0.08); return; } // sampled loops, pitched by revs
      engine.o1.frequency.setTargetAtTime(f, t, 0.05);
      engine.o2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
      engine.f.frequency.setTargetAtTime(300 + load * 1400 + rpm * 600, t, 0.05);
      engine.g.gain.setTargetAtTime(on ? 0.07 + load * 0.06 : 0, t, 0.08);
    },
    shot(id, p, mine) {
      const a = mine ? 1 : att(p);
      if (id === "mg" && samples.play("shot", 0.3 * a, 1.1)) return;
      if (id === "scatter" && samples.play("pistol", 0.55 * a, 0.7)) return;
      if ((id === "autocannon" || id === "cannon") && samples.play("cannon", 0.5 * a)) return;
      if (id === "mg") noise(0.07, 2600, 1.2, 0.22 * a, "bandpass", 0.4);
      else if (id === "scatter") { noise(0.28, 1200, 0.8, 0.5 * a, "lowpass", 0.2); tone(90, 0.15, 0.2 * a, "square", 0.5); }
      else if (id === "rockets") noise(0.5, 900, 1.5, 0.3 * a, "bandpass", 3);
      else if (id === "autocannon" || id === "cannon") { noise(0.18, 900, 1, 0.45 * a, "lowpass", 0.3); tone(70, 0.2, 0.3 * a, "sine", 0.5); }
      else if (id === "harpoon") tone(400, 0.25, 0.2 * a, "sawtooth", 0.3);
      else if (id === "flamer") noise(0.3, 500, 0.6, 0.18 * a, "lowpass");
    },
    explosion(p, scale = 1) {
      const a = att(p);
      if (samples.play("explosion", 0.9 * a * Math.min(1.2, scale), Math.max(0.7, Math.min(1.2, 1.2 - scale * 0.2)))) return;
      noise(1.4 * scale, 700, 0.7, 0.9 * a * Math.min(1.2, scale), "lowpass", 0.08);
      tone(60, 0.6, 0.6 * a, "sine", 0.4);
    },
    // A sample by key at a place (null: no distance fade). false when the pack has not got it (yet).
    sample(key, p, gain = 1, rate = 1) { return samples.play(key, att(p) * gain, rate); },
    sampleState: () => ({ keys: samples.keys(), engineLoops: loops.ready() }),
    impact(p, k) { const a = att(p) * k; if (samples.play(k >= 0.75 ? "slam" : k >= 0.3 ? "metal" : "hit", 0.7 * a)) return; noise(0.16, 1500, 3, 0.4 * a, "bandpass", 0.5); tone(140 + Math.random() * 80, 0.12, 0.15 * a, "triangle", 0.6); },
    pickup() { if (samples.play("ui_pop", 0.45)) return; tone(880, 0.08, 0.15, "square", 1.5); tone(1320, 0.12, 0.12, "square", 1.2, "sfx", 0.06); },
    bank() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 0.15, "square", 1, "sfx", i * 0.07)); },
    callout() { tone(330, 0.15, 0.12, "sawtooth", 2); },
    hitMarker() { tone(1800, 0.04, 0.06, "square"); },
    horn() { if (samples.play("horn", 0.5)) return; tone(330, 0.4, 0.2, "sawtooth"); tone(415, 0.4, 0.2, "sawtooth"); },
    // Fuel: a gulping pour, an engine cough, and the radio squelch before a line.
    glug() { const f = 160 + Math.random() * 60; tone(f, 0.14, 0.12, "sine", 1.8); noise(0.12, 500, 2, 0.06, "bandpass", 1.6); },
    sputter() { for (let i = 0; i < 3; i++) { tone(70 + Math.random() * 20, 0.07, 0.18, "square", 0.6, "sfx", i * 0.11); noise(0.06, 300, 1, 0.15, "lowpass", 0.5); } },
    radio() { noise(0.12, 2400, 1.5, 0.08, "bandpass"); tone(1250, 0.06, 0.05, "square", 1, "voice"); tone(1650, 0.06, 0.05, "square", 1, "voice", 0.08); },
    // Bases: a rising-falling siren and a heavy clank (claim, module landing).
    siren() { for (let i = 0; i < 3; i++) { tone(520, 0.45, 0.13, "sawtooth", 1.7, "sfx", i * 0.9); tone(880, 0.45, 0.11, "sawtooth", 0.6, "sfx", i * 0.9 + 0.45); } },
    clank() { if (samples.play("slam", 0.6, 0.8)) return; tone(95, 0.35, 0.3, "square", 0.5); noise(0.25, 900, 2, 0.35, "bandpass", 0.4); tone(310, 0.12, 0.12, "triangle", 0.7, "sfx", 0.05); },
    suspend() { if (ctx) ctx.suspend(); },
    resume() { if (ctx) ctx.resume(); },
    dispose() { clearInterval(music); loops.dispose(); if (ctx) ctx.close(); ctx = null; },
  };
}