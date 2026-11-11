// Place labels: replaces the always-on world labels with smaller ones on a dark plate that only show within
// LABEL_RANGE (or while the place is the map target) and fade with distance. Minimap names are unaffected.
import * as THREE from "three";
import { PLACES } from "@/game/data/places";

const LABEL_RANGE = 120, FADE = 35;

function plate(text) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 112;
  const ctx = c.getContext("2d");
  ctx.font = 'bold 40px "Black Ops One", Impact, sans-serif';
  const t = text.toUpperCase(), w = Math.min(492, ctx.measureText(t).width + 56), x0 = (512 - w) / 2;
  ctx.fillStyle = "rgba(14,11,8,0.78)"; ctx.fillRect(x0, 22, w, 64);
  ctx.fillStyle = "#f2c230"; ctx.fillRect(x0, 82, w, 4);
  ctx.fillStyle = "rgba(242,194,48,0.35)"; ctx.fillRect(x0, 22, w, 2);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#f2e6c8";
  ctx.fillText(t, 256, 55, 470);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlaceLabels(scene, world) {
  const items = [];
  for (const old of world.labels) {
    old.visible = false;
    const place = PLACES.slice().sort((a, b) => Math.hypot(a.x - old.position.x, a.z - old.position.z) - Math.hypot(b.x - old.position.x, b.z - old.position.z))[0];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: plate(place.name), depthWrite: false, transparent: true, fog: false, sizeAttenuation: false, opacity: 0 }));
    sp.scale.set(0.1, 0.022, 1);
    sp.position.copy(old.position).setY(old.position.y - 6);
    sp.renderOrder = 10;
    sp.visible = false;
    scene.add(sp);
    items.push({ sp, place });
  }
  return {
    items,
    // from: the player's position; target: place id the map is pointing at (optional).
    update(from, target) {
      for (const it of items) {
        const d = Math.hypot(it.sp.position.x - from.x, it.sp.position.z - from.z);
        let k = Math.max(0, Math.min(1, (LABEL_RANGE - d) / FADE));
        if (target && target === it.place.id) k = 1;
        const m = it.sp.material;
        m.opacity += (k - m.opacity) * 0.15;
        it.sp.visible = m.opacity > 0.02;
      }
    },
  };
}