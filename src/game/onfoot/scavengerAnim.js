// Procedural idle, walk, run and jump animation for the scavenger rig (scavengerMesh.js). Poses blend by
// weight, so starting, stopping and landing ease rather than snap. Always 1x time: dt is the real frame time.
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);

export function newAnimState() {
  return { phase: 0, idleT: 0, walk: 0, run: 0, air: 0 };
}

// m: { speed (m/s on the ground), running, airborne }
export function animateScavenger(J, st, m, dt) {
  const moving = !m.airborne && m.speed > 0.3;
  st.walk = damp(st.walk, moving && !m.running ? 1 : 0, 8, dt);
  st.run = damp(st.run, moving && m.running ? 1 : 0, 8, dt);
  st.air = damp(st.air, m.airborne ? 1 : 0, 10, dt);
  const idle = Math.max(0, 1 - st.walk - st.run - st.air);
  st.phase += dt * (m.running ? 1.55 : 1.15) * Math.max(1.2, m.speed) * 1.6;
  st.idleT += dt;

  const s = Math.sin(st.phase), c = Math.cos(st.phase);
  const W = st.walk, R = st.run, A = st.air;
  const legSwing = s * (0.5 * W + 0.85 * R);
  const kneeL = Math.max(0, -s) * (0.7 * W + 1.2 * R) + 0.9 * A + 0.05;
  const kneeR = Math.max(0, s) * (0.7 * W + 1.2 * R) + 0.9 * A + 0.05;
  const armSwing = s * (0.4 * W + 0.75 * R);
  const breathe = Math.sin(st.idleT * 1.8) * 0.02 * idle;

  J.legL.rotation.x = legSwing + 0.55 * A; // knees tuck up in the air
  J.legR.rotation.x = -legSwing + 0.3 * A;
  // Rotation about x: positive swings a hanging limb forward (-z). Knees bend back, elbows bend forward.
  J.kneeL.rotation.x = -kneeL;
  J.kneeR.rotation.x = -kneeR;
  J.armL.rotation.x = -armSwing + 0.7 * A;
  J.armR.rotation.x = armSwing + 0.7 * A;
  J.armL.rotation.z = -0.08 - 0.25 * A;
  J.armR.rotation.z = 0.08 + 0.25 * A;
  J.elbowL.rotation.x = 0.25 * W + 1.1 * R + 0.4 * A + 0.12 * idle;
  J.elbowR.rotation.x = 0.25 * W + 1.1 * R + 0.4 * A + 0.12 * idle;
  J.torso.rotation.x = -(0.06 * W + 0.28 * R) + breathe;
  J.torso.rotation.y = s * 0.08 * (W + R);
  J.hips.position.y = 0.93 + Math.abs(c) * (0.035 * W + 0.06 * R) - 0.04 * R + breathe * 0.5;
  J.head.rotation.x = 0.04 * W + 0.2 * R + breathe;
  J.head.rotation.y = Math.sin(st.idleT * 0.45) * 0.35 * idle;
  J.tail.rotation.x = -(0.1 + 0.35 * R + 0.25 * W * Math.abs(s) + 0.5 * A); // coat tail flares back
  J.scarfTail.rotation.x = -(0.2 + 0.9 * R + 0.4 * W + Math.sin(st.idleT * 3.1) * 0.08 + 0.6 * A);
  J.scarfTail.rotation.z = Math.sin(st.idleT * 2.3) * 0.15;
}