// Emote wheel lines: a bubble over the car for 3 s, a horn blast and a headlight flash.
import * as THREE from "three";

export const EMOTES = ["GG!", "COME AT ME", "HELP!", "TRUCE?"];

export function showEmote(game, v, id) {
  const text = EMOTES[id];
  if (!v || !text || !v.mesh.root.parent) return;
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(242,194,48,0.95)"; ctx.fillRect(8, 6, 240, 44);
  ctx.beginPath(); ctx.moveTo(116, 50); ctx.lineTo(140, 50); ctx.lineTo(128, 62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1b140b"; ctx.font = 'bold 28px "Black Ops One", Impact, sans-serif';
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 128, 29);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, fog: false, sizeAttenuation: false }));
  sp.scale.set(0.09, 0.0225, 1); sp.center.set(0.5, 0); sp.renderOrder = 21;
  sp.position.set(0, v.chassis.hit.center[1] + v.chassis.hit.half[1] * 2 + 2.6, 0);
  v.mesh.root.add(sp);
  setTimeout(() => { sp.removeFromParent(); tex.dispose(); sp.material.dispose(); }, 3000);
  game.audio.horn();
  const f = new THREE.Vector3(0, 0.4, -v.chassis.hit.half[2] - 1).applyQuaternion(v.quat).add(v.pos);
  game.fx.flash(f.x, f.y, f.z, 300, 0.4);
}