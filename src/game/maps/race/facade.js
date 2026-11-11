// Building looks for the race worlds: one wall texture of 4 x 4 windows (16 m x 14 m) per style, lit windows as
// an emissive map at night, and a box whose side UVs are in metres so every template shows windows of one size.
// near: the detailed material (shadows, PBR). far: a cheap Lambert for the distant chunks.
import * as THREE from "three";

const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

function wallCanvas(style, emissive) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = emissive ? "#000" : style === "ruin" ? "#8d8578" : "#77726a";
  g.fillRect(0, 0, 128, 128);
  if (!emissive) for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + hash(i, 1) * 0.12})`; g.fillRect(hash(i, 2) * 128, hash(i, 3) * 128, 3 + hash(i, 4) * 22, 2 + hash(i, 5) * 5); }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const lit = style === "night" && hash(i * 4 + j, 7) < 0.42, warm = hash(i * 4 + j, 8) < 0.7;
    if (emissive) { if (!lit) continue; g.fillStyle = warm ? "#ffc878" : "#a8d4ff"; }
    else g.fillStyle = lit ? (warm ? "#e8b868" : "#9cc4e8") : style === "ruin" && hash(i * 4 + j, 9) < 0.5 ? "#15130f" : "#23282c";
    g.fillRect(i * 32 + 9, j * 32 + 8, 14, 17);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createFacade(style = "night") {
  const map = wallCanvas(style, false), glow = style === "night" ? wallCanvas(style, true) : null;
  const lit = glow ? { emissiveMap: glow, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 2.4 } : {};
  const near = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...lit });
  const far = new THREE.MeshLambertMaterial({ map, ...lit });
  const geos = new Map();
  return {
    near, far,
    /** A w x h x d box, origin at the middle of its base, windows on the four sides, a plain roof. */
    box(w, h, d) {
      const k = `${w}:${h}:${d}`;
      if (geos.has(k)) return geos.get(k);
      const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), uv = geo.attributes.uv;
      for (let i = 0; i < 24; i++) {
        const roof = i >= 8 && i < 16, span = i < 8 ? d : w;
        uv.setXY(i, roof ? 0 : (uv.getX(i) * span) / 16, roof ? 0 : (uv.getY(i) * h) / 14);
      }
      geos.set(k, geo);
      return geo;
    },
    dispose() { map.dispose(); if (glow) glow.dispose(); near.dispose(); far.dispose(); for (const g of geos.values()) g.dispose(); },
  };
}