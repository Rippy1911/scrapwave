// Draw emblem to a 2d canvas context (nametag + profile).

const ICON_PATHS = [
  (c) => { c.moveTo(0, -10); c.lineTo(6, 8); c.lineTo(-6, 8); c.closePath(); },
  (c) => { c.arc(0, 0, 8, 0, Math.PI * 2); c.moveTo(0, -8); c.lineTo(0, 8); c.moveTo(-8, 0); c.lineTo(8, 0); },
  (c) => { c.arc(-3, -2, 4, 0, Math.PI * 2); c.arc(3, -2, 4, 0, Math.PI * 2); c.moveTo(-6, 6); c.quadraticCurveTo(0, 12, 6, 6); },
  (c) => { c.arc(0, 0, 9, 0, Math.PI * 2); c.moveTo(-9, 0); c.lineTo(9, 0); c.moveTo(0, -9); c.lineTo(0, 9); },
  (c) => { c.rect(-7, -3, 14, 4); c.moveTo(-4, -3); c.lineTo(-1, -9); c.lineTo(1, -9); c.lineTo(4, -3); },
  (c) => { c.moveTo(0, 10); c.quadraticCurveTo(10, -2, 0, -8); c.quadraticCurveTo(-10, -2, 0, 10); },
  (c) => { c.moveTo(-12, 4); c.quadraticCurveTo(0, -12, 12, 4); c.lineTo(0, 0); c.closePath(); },
  (c) => { c.arc(0, 0, 9, 0, Math.PI * 2); c.moveTo(0, -9); c.lineTo(0, 9); c.moveTo(-9, 0); c.lineTo(9, 0); c.arc(0, 0, 3, 0, Math.PI * 2); },
  (c) => { c.moveTo(-8, 8); c.lineTo(0, -10); c.lineTo(8, 8); c.lineTo(0, 2); c.closePath(); },
  (c) => { c.rect(-3, -8, 6, 12); c.moveTo(-8, -4); c.lineTo(8, -4); },
  (c) => { c.moveTo(-10, 6); c.lineTo(0, -8); c.lineTo(10, 6); },
  (c) => { c.rect(-8, -6, 16, 12); c.moveTo(-8, -6); c.lineTo(0, -10); c.lineTo(8, -6); },
  (c) => { c.arc(0, 0, 4, 0, Math.PI * 2); c.moveTo(-6, 6); c.lineTo(6, 6); c.moveTo(0, -8); c.lineTo(0, -4); },
  (c) => { c.rect(-4, -8, 8, 16); c.moveTo(-6, 0); c.lineTo(6, 0); },
  (c) => { c.moveTo(-8, 4); c.lineTo(-4, -6); c.lineTo(0, 4); c.lineTo(4, -6); c.lineTo(8, 4); },
  (c) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); } },
  (c) => { c.moveTo(-10, 0); c.lineTo(10, 0); c.quadraticCurveTo(0, -8, -10, 0); c.quadraticCurveTo(0, 8, 10, 0); },
  (c) => { c.moveTo(-8, 8); c.lineTo(8, 8); c.lineTo(0, -8); c.closePath(); c.arc(0, 2, 3, 0, Math.PI * 2); },
  (c) => { c.moveTo(-6, 8); c.lineTo(-2, -6); c.lineTo(2, -6); c.lineTo(6, 8); c.closePath(); },
  (c) => { c.arc(0, 0, 9, 0, Math.PI * 2); c.moveTo(-9, -3); c.lineTo(9, -3); c.moveTo(0, -9); c.lineTo(0, 9); },
  (c) => { c.moveTo(-10, 6); c.lineTo(0, -10); c.lineTo(10, 6); c.moveTo(0, -10); c.lineTo(0, -14); },
  (c) => { c.moveTo(-10, 6); c.quadraticCurveTo(0, -10, 10, 6); c.lineTo(10, 10); c.lineTo(-10, 10); c.closePath(); },
  (c) => { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * Math.PI * 2; const x = Math.cos(a) * 9, y = Math.sin(a) * 9; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.closePath(); },
  (c) => { c.arc(0, 4, 8, Math.PI, 0); c.moveTo(-8, 4); c.lineTo(8, 4); c.moveTo(-5, -6); c.lineTo(5, -6); },
];

function drawShape(ctx, shape, r) {
  ctx.beginPath();
  if (shape === "circle") ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (shape === "shield") {
    ctx.moveTo(0, -r); ctx.lineTo(r, -r * 0.3); ctx.lineTo(r * 0.85, r); ctx.lineTo(-r * 0.85, r); ctx.lineTo(-r, -r * 0.3); ctx.closePath();
  } else if (shape === "hex") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === "diamond") {
    ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
  } else if (shape === "star") {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

export function drawEmblem(ctx, avatar, size = 24) {
  const a = avatar || {};
  const r = size * 0.42;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = a.color2 || "#1a1410";
  drawShape(ctx, a.shape || "circle", r);
  ctx.fill();
  ctx.fillStyle = a.color || "#c7762e";
  drawShape(ctx, a.shape || "circle", r * 0.82);
  ctx.fill();
  ctx.strokeStyle = a.color2 || "#3a3734";
  ctx.lineWidth = a.border === "double" ? 2 : 1.5;
  if (a.border && a.border !== "none") {
    if (a.border === "dash") ctx.setLineDash([3, 2]);
    else if (a.border === "barbed") { ctx.lineWidth = 2.5; ctx.strokeStyle = a.color || "#c7762e"; }
    else if (a.border === "crown") { ctx.lineWidth = 3; ctx.strokeStyle = "#f2c230"; }
    drawShape(ctx, a.shape || "circle", r * 0.92);
    ctx.stroke();
    if (a.border === "double") {
      drawShape(ctx, a.shape || "circle", r * 0.72);
      ctx.stroke();
    }
  }
  const icon = Math.max(0, Math.min(23, a.icon | 0));
  ctx.fillStyle = a.color2 || "#1a1410";
  ctx.strokeStyle = a.color2 || "#1a1410";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ICON_PATHS[icon]?.(ctx);
  ctx.fill();
  ctx.restore();
}
