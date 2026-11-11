// Rocket lock tone: a short rising double beep when the rocket lock closes. Own tiny audio context (created on
// first use, which always follows a key press), scaled by the saved master and sfx volumes.
let ctx = null;

export function lockTone(save) {
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  const vol = (save && save.volume) || { master: 0.8, sfx: 0.9 };
  const gain = 0.08 * vol.master * vol.sfx;
  if (gain < 0.002) return;
  [0, 0.09].forEach((d, i) => {
    const t = ctx.currentTime + d;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square"; o.frequency.setValueAtTime(i ? 1320 : 990, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.09);
  });
}