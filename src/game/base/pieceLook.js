// Piece looks: one procedural canvas texture and material per material × tier (shared by every piece, so a full
// plot costs one draw call per piece), plus a shared crack texture for damage overlays.
import * as THREE from "three";
import { MATERIALS, tierOf } from "@/game/base/materials";

const cache = new Map();
let crackTex = null;
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

function noise(g, size, color, n, a) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) { g.globalAlpha = Math.random() * a; g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  g.globalAlpha = 1;
}

function drawMaterial(m, tier) {
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = hex(m.color); g.fillRect(0, 0, S, S);
  if (m.id === "wood") for (let y = 0; y < S; y += 16) { g.fillStyle = hex(m.color2); g.fillRect(0, y, S, 2); noise(g, S, "#3a2814", 40, 0.4); }
  else if (m.id === "sheet") for (let x = 0; x < S; x += 12) { g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, 0, 4, S); }
  else if (m.id === "concrete") { noise(g, S, "#5a554c", 500, 0.35); g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(0, S / 2, S, 2); }
  else { g.fillStyle = hex(m.color2); g.fillRect(0, 0, S, 6); g.fillRect(0, S - 6, S, 6); }
  noise(g, S, "#7a4a22", m.metal ? 160 : 60, 0.35); // rust and grime
  const t = tierOf(tier).look;
  if (t >= 1) { // Tier II: reinforcing bands
    g.fillStyle = "rgba(30,28,26,.85)";
    g.fillRect(0, 22, S, 8); g.fillRect(0, S - 30, S, 8);
  }
  if (t >= 2) { // Tier III: riveted plates and a yellow stencil edge
    g.fillStyle = "#c9c2b0";
    for (let x = 6; x < S; x += 16) for (const y of [26, S - 26]) { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#f2c230"; g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function pieceMaterial(matId, tier) {
  const key = matId + tier;
  if (cache.has(key)) return cache.get(key);
  const m = MATERIALS[matId] || MATERIALS.wood;
  const mat = new THREE.MeshStandardMaterial({ map: drawMaterial(m, tier), roughness: m.rough, metalness: m.metal * 0.6 });
  cache.set(key, mat);
  return mat;
}

// Transparent crack lines and dark holes; the overlay's opacity rises with damage.
export function crackTexture() {
  if (crackTex) return crackTex;
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.strokeStyle = "rgba(12,10,8,.95)"; g.lineCap = "round";
  for (let k = 0; k < 9; k++) {
    let x = Math.random() * S, y = Math.random() * S;
    g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 7; i++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  for (let k = 0; k < 5; k++) { g.fillStyle = "rgba(8,6,5,.9)"; g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 3 + Math.random() * 7, 0, Math.PI * 2); g.fill(); }
  crackTex = new THREE.CanvasTexture(c);
  crackTex.colorSpace = THREE.SRGBColorSpace;
  return crackTex;
}

export const crackMaterial = () => new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });