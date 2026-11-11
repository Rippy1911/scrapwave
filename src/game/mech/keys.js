// Keys 1-9 for moving machines, in Drive and Walker mode. A joint bound to a key swings (or slides) to its max
// while the key is held and back when released; a spinning rotor or motor turns while held. A pose bound to a key
// blends every joint in it into place on a press, and back to rest on the next press.
import { createPoseTrack } from "@/game/mech/pose";

const toward = (x, y, step) => (Math.abs(y - x) <= step ? y : x + Math.sign(y - x) * step);

export function createJointKeys(D, poses) {
  const track = createPoseTrack({});
  const vals = {}, down = new Set();
  const st = { active: 0 };
  const rest = (j) => Math.min(j.max, Math.max(j.min, 0));
  // held(n) -> boolean for key n (1..9). Writes the manual joint values into out.
  st.step = (dt, held, out) => {
    for (let n = 1; n <= 9; n++) {
      const h = held(n);
      if (h && !down.has(n)) st.press(n);
      if (h) down.add(n); else down.delete(n);
    }
    track.step(dt);
    for (const j of D.info) {
      const base = track.current[j.id] ?? rest(j), sp = (j.speed || 2) * dt;
      if (j.key && down.has(j.key)) vals[j.id] = j.spin ? (vals[j.id] ?? base) + sp : toward(vals[j.id] ?? base, j.max, sp);
      else vals[j.id] = j.spin ? (vals[j.id] ?? base) : toward(vals[j.id] ?? base, base, sp);
      out[j.id] = vals[j.id];
    }
  };
  st.press = (n) => {
    const p = poses.find((x) => x.key === n);
    if (!p) return false;
    if (st.active === n) { const back = {}; for (const id in p.values) back[id] = 0; track.set(back, 0.45); st.active = 0; }
    else { track.set(p.values, 0.45); st.active = n; }
    return true;
  };
  st.pose = (name) => { const p = poses.find((x) => x.name.toLowerCase() === String(name).toLowerCase()); if (!p) return false; track.set(p.values, 0.45); st.active = p.key; return true; };
  st.set = (id, v) => { vals[id] = v; track.snap({ [id]: v }); };
  st.bound = () => [...D.info.filter((j) => j.key).map((j) => ({ key: j.key, kind: "joint", name: j.role || j.t, held: down.has(j.key) })),
    ...poses.filter((p) => p.key).map((p) => ({ key: p.key, kind: "pose", name: p.name, on: st.active === p.key }))].sort((a, b) => a.key - b.key);
  return st;
}