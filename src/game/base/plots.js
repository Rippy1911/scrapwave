// Plots: beacon poles, 60x60 hazard rings, the 5 s claim, ownership and owner labels.
import * as THREE from "three";
import { BASE } from "@/game/data/tuning";
import worldConfig from "@/game/net/world-config.json";

const CLAIM_TIME = 5, BEACON_R = 14, HALF = 30;

function plotDefs() {
  const src = worldConfig.plots || worldConfig.base?.plots || BASE.plots || [];
  return src.map((p, i) => ({ id: p.id || `p${i + 1}`, x: p.x ?? p.pos?.[0] ?? 0, z: p.z ?? p.pos?.[1] ?? p.pos?.[2] ?? 0, name: p.name || "" }));
}

export function labelSprite() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(10, 1.9, 1); s.userData.canvas = c;
  return s;
}
export function drawLabel(s, text, sub, color = "#f2c230") {
  const c = s.userData.canvas, g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(18,16,14,0.78)"; g.fillRect(40, 6, 432, 84);
  g.fillStyle = color; g.fillRect(40, 6, 8, 84);
  g.font = "bold 38px Impact, sans-serif"; g.textAlign = "center"; g.fillStyle = "#f4ead6";
  g.fillText(text, 260, 48);
  if (sub) { g.font = "bold 24px sans-serif"; g.fillStyle = color; g.fillText(sub, 260, 80); }
  s.material.map.needsUpdate = true;
}

function buildPlotMesh(game, def, ground) {
  const { M } = game, root = new THREE.Group();
  root.position.set(def.x, ground, def.z);
  // ring: four striped strips hugging the ground
  const stripe = M.hazard;
  for (let i = 0; i < 4; i++) {
    const along = i < 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(along ? HALF * 2 : 1.2, 0.12, along ? 1.2 : HALF * 2), stripe);
    m.position.set(along ? 0 : (i === 2 ? -HALF : HALF), 0.06, along ? (i === 0 ? -HALF : HALF) : 0);
    m.receiveShadow = true; root.add(m);
  }
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 6), M.dark);
    post.position.set(cx * HALF, 0.7, cz * HALF); root.add(post);
  }
  // beacon pole + flag frame, offset from the centre so the Rig has room
  const bx = HALF - 8, bz = -HALF + 8;
  const beacon = new THREE.Group(); beacon.position.set(bx, 0, bz); root.add(beacon);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 2.2), M.concrete); base.position.y = 0.4; beacon.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 14, 8), M.rust); pole.position.y = 7.6; pole.castShadow = true; beacon.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 0.14), M.dark); arm.position.set(1.7, 14.2, 0); beacon.add(arm);
  const arm2 = arm.clone(); arm2.position.y = 11.6; beacon.add(arm2);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: "#f2c230" }));
  lamp.position.y = 14.9; beacon.add(lamp);
  const flagMat = new THREE.MeshStandardMaterial({ color: "#6b625a", roughness: 0.9, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4, 8, 2), flagMat);
  flag.geometry.translate(1.6, -1.2, 0);
  flag.position.set(0.1, 14.1, 0); flag.scale.set(0.15, 1, 1); beacon.add(flag);
  const label = labelSprite(); label.position.set(0, 17.4, 0); beacon.add(label);
  drawLabel(label, def.name ? def.name.toUpperCase() : "OPEN PLOT", def.id.toUpperCase() + " · UNCLAIMED", "#a8987f");
  game.scene.add(root);
  game.world.colliders.add({ x: def.x + bx, y: ground + 0.4, z: def.z + bz, hx: 1.1, hy: 0.4, hz: 1.1, tag: "beacon" });
  game.world.colliders.add({ x: def.x + bx, y: ground + 7.6, z: def.z + bz, hx: 0.2, hy: 7, hz: 0.2, tag: "beacon" });
  return { root, beacon, flag, flagMat, lamp, label, beaconWorld: new THREE.Vector3(def.x + bx, ground, def.z + bz) };
}

export function createPlots(game) {
  const plots = plotDefs().map((def) => {
    const ground = game.world.groundAt(def.x, def.z, 999);
    return { ...def, y: ground, owner: null, stash: 0, dark: false, claimedAt: 0, unfurl: 0, ...buildPlotMesh(game, def, ground) };
  });
  const byId = Object.fromEntries(plots.map((p) => [p.id, p]));
  const claim = { plot: null, t: 0, pending: false };

  const inside = (p, x, z) => Math.abs(x - p.x) < HALF && Math.abs(z - p.z) < HALF;
  const at = (x, z) => plots.find((p) => inside(p, x, z)) || null;
  const ownedBy = (ownerId) => plots.find((p) => p.owner && p.owner.id === ownerId && !p.dark) || null;
  const mine = () => ownedBy(game.selfId());

  function setOwner(id, owner) {
    const p = byId[id];
    if (!p) return null;
    p.owner = owner; p.dark = false; p.claimedAt = game.time; p.unfurl = owner ? 0.001 : 0;
    p.flagMat.color.set(owner ? owner.paint || "#c7762e" : "#6b625a");
    p.lamp.material.color.set(owner ? (owner.id === game.selfId() ? "#7fe0a0" : "#ff5a3a") : "#f2c230");
    if (!owner) { p.flag.scale.x = 0.15; p.stash = 0; }
    drawLabel(p.label, owner ? owner.name.toUpperCase() : "OPEN PLOT", p.id.toUpperCase() + (owner ? " · CLAIMED" : " · UNCLAIMED"), owner ? owner.paint || "#f2c230" : "#a8987f");
    return p;
  }
  function setDark(id) {
    const p = byId[id];
    if (!p) return;
    p.dark = true; p.lamp.material.color.set("#2a2622");
    drawLabel(p.label, (p.owner?.name || "PLOT").toUpperCase(), "BASE DOWN · DARK", "#ff5a3a");
  }

  // Player claim: stand still in the ring near the beacon for 5 s, then ask the net.
  function update(dt) {
    const v = game.player, t = game.time;
    for (const p of plots) {
      if (p.unfurl > 0 && p.unfurl < 1) { p.unfurl = Math.min(1, p.unfurl + dt * 1.2); p.flag.scale.x = 0.15 + 0.85 * p.unfurl; }
      if (p.owner) {
        const pos = p.flag.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin(x * 1.6 - t * 5 + p.x) * 0.18 * (x / 3.2)); }
        pos.needsUpdate = true;
      }
    }
    if (!v || !v.alive || claim.pending || game.buildView?.active) { claim.t = 0; claim.plot = null; return; }
    const p = at(v.pos.x, v.pos.z);
    const can = p && !p.owner && !game.base.claimedThisCycle(game.selfId()) && v.vel.length() < 1.2 &&
      Math.hypot(v.pos.x - p.beaconWorld.x, v.pos.z - p.beaconWorld.z) < BEACON_R;
    if (!can) { claim.t = Math.max(0, claim.t - dt * 2); if (claim.t === 0) claim.plot = null; return; }
    if (claim.plot !== p) { claim.plot = p; claim.t = 0; }
    claim.t += dt;
    if (Math.floor((claim.t - dt) * 2) !== Math.floor(claim.t * 2)) game.audio.hitMarker?.();
    if (claim.t >= CLAIM_TIME) { claim.pending = true; claim.t = CLAIM_TIME; game.base.requestClaim(p.id); setTimeout(() => { claim.pending = false; claim.t = 0; claim.plot = null; }, 1500); }
  }

  function dispose() { for (const p of plots) p.root.removeFromParent(); }

  return {
    list: plots, byId, at, inside, mine, ownedBy, setOwner, setDark, update, dispose, HALF,
    claimState: () => (claim.plot ? { id: claim.plot.id, k: claim.t / CLAIM_TIME } : null),
  };
}