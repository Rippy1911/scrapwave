// The green "FREE" tag floating over a free vehicle nobody is driving (one shared canvas texture).
import * as THREE from "three";

let mat = null;
function material() {
  if (mat) return mat;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 96;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(14,22,16,0.82)";
  x.fillRect(8, 14, 240, 68);
  x.strokeStyle = "#7fe0a0"; x.lineWidth = 6;
  x.strokeRect(8, 14, 240, 68);
  x.fillStyle = "#7fe0a0";
  x.font = "bold 56px Impact, 'Black Ops One', sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("FREE", 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  return mat;
}

export function addFreeMarker(v) {
  const s = new THREE.Sprite(material());
  s.scale.set(2.2, 0.82, 1);
  s.position.set(0, v.chassis.hit.half[1] + v.chassis.hit.center[1] + 1.6, 0);
  s.renderOrder = 3;
  v.mesh.root.add(s);
  v.freeMarker = s;
  return s;
}

export function setFreeMarker(v, on, time = 0) {
  if (!v.freeMarker) return;
  v.freeMarker.visible = on;
  if (on) v.freeMarker.position.y = v.chassis.hit.half[1] + v.chassis.hit.center[1] + 1.6 + Math.sin(time * 2 + v.id) * 0.12;
}