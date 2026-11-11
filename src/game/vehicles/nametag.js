// Floating name tags (with a small AI badge), the red payback marker and the ?debug=1 AI goal label.
import * as THREE from "three";
import { drawEmblem } from "@/game/fame/emblemDraw";

function spriteFromCanvas(c, w, h) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true, fog: false, sizeAttenuation: false }));
  sp.scale.set(w, h, 1);
  sp.renderOrder = 20;
  return sp;
}

function drawTag(ctx, name, color, ai, sub, avatar) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const emblemW = avatar ? 36 : 0;
  ctx.font = 'bold 30px "Rajdhani", sans-serif';
  const badge = ai ? 44 : 0, tw = Math.min(W - 24 - badge - emblemW, ctx.measureText(name).width);
  const total = tw + badge + 20 + emblemW, x0 = (W - total) / 2;
  ctx.fillStyle = "rgba(18,14,10,0.72)"; ctx.fillRect(x0, 6, total, sub ? 52 : 40);
  ctx.fillStyle = color; ctx.fillRect(x0, sub ? 56 : 44, total, 3);
  if (emblemW) {
    ctx.save();
    ctx.translate(x0 + 20, 26);
    drawEmblem(ctx, avatar, 32);
    ctx.restore();
  }
  if (ai) {
    const bx = x0 + emblemW + 4;
    ctx.fillStyle = "#5d8fd6"; ctx.fillRect(bx + 2, 13, 34, 26);
    ctx.fillStyle = "#0e1420"; ctx.font = 'bold 20px "Rajdhani", sans-serif'; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillText("AI", bx + 19, 27);
  }
  ctx.font = 'bold 30px "Rajdhani", sans-serif'; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2e6c8";
  ctx.fillText(name, x0 + 10 + badge + emblemW, 27, tw);
  if (sub) {
    ctx.font = 'bold 16px "Rajdhani", sans-serif'; ctx.textAlign = "center"; ctx.fillStyle = color;
    ctx.fillText(sub, W / 2, 48);
  }
}

export function createNameTag(game, v, name, color = "#f2c230", ai = true, sub = "") {
  const c = document.createElement("canvas"); c.width = 360; c.height = sub ? 72 : 68;
  const ctx = c.getContext("2d");
  drawTag(ctx, name, color, ai, sub, null);
  const sprite = spriteFromCanvas(c, 0.124, sub ? 0.027 : 0.0234);
  const top = v.chassis.hit.center[1] + v.chassis.hit.half[1] * 2 + 1.1;
  sprite.position.set(0, top, 0);
  sprite.center.set(0.5, 0);
  v.mesh.root.add(sprite);
  const pc = document.createElement("canvas"); pc.width = 256; pc.height = 64;
  const p = pc.getContext("2d");
  p.fillStyle = "#ff3a20";
  p.beginPath(); p.moveTo(108, 34); p.lineTo(148, 34); p.lineTo(128, 60); p.closePath(); p.fill();
  p.font = 'bold 26px "Black Ops One", Impact, sans-serif'; p.textAlign = "center"; p.textBaseline = "middle";
  p.lineWidth = 5; p.strokeStyle = "#1b0a06"; p.strokeText("PAYBACK", 128, 16); p.fillText("PAYBACK", 128, 16);
  const payback = spriteFromCanvas(pc, 0.07, 0.0175);
  payback.center.set(0.5, 0); payback.position.set(0, top + 1.2, 0); payback.visible = false;
  v.mesh.root.add(payback);
  v.tag = { sprite, canvas: c, ctx, tex: sprite.material.map, payback, name, color, ai, sub: sub || "", debugText: "", avatar: null, hasSub: !!sub };
  return v.tag;
}

export function redrawNameTag(v, { sub, avatar } = {}) {
  const t = v.tag;
  if (!t) return;
  if (sub != null) t.sub = sub;
  if (avatar !== undefined) t.avatar = avatar;
  const text = t.debugText || t.sub;
  const tall = !!(text);
  if (t.canvas.height !== (tall ? 72 : 68)) {
    t.canvas.height = tall ? 72 : 68;
    t.sprite.scale.set(0.124, tall ? 0.027 : 0.0234, 1);
  }
  drawTag(t.ctx, t.name, t.color, t.ai, text, t.avatar);
  t.tex.needsUpdate = true;
}

// Second line under the name (AI goal in debug mode).
export function setTagSub(v, text) {
  const t = v.tag;
  if (!t) return;
  t.debugText = text;
  redrawNameTag(v, { sub: text || t.sub });
}

export function setPayback(v, on) { if (v.tag) v.tag.payback.visible = on; }

// Per frame: hide tags that are far away, behind walls of distance, or on wrecks.
export function updateTags(game, camPos) {
  for (const v of game.vehicles) {
    if (!v.tag) continue;
    const d = v.mesh.root.position.distanceTo(camPos);
    v.tag.sprite.visible = v.alive && d < 170 && d > 3 && v !== game.player;
    if (v === game.player) v.tag.sprite.visible = game.autopilot && !(game.demo && game.demo.running) && d > 3;
    if (!v.alive) v.tag.payback.visible = false;
  }
}

export function disposeTag(v) {
  if (!v.tag) return;
  v.tag.tex.dispose(); v.tag.sprite.material.dispose();
  v.tag.payback.material.map.dispose(); v.tag.payback.material.dispose();
}
