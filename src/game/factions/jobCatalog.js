// Faction jobs. The five original radio jobs keep their tuning (JOBS.defs) and now belong to a faction; the rest are
// new. mech: how base/jobs.js tracks it ("count" wrecks of `targets`, "escort" the water convoy, or the job's own kind).
// need: the giver's standing needed to see it. rep: standing with the giver on success; rival: standing lost elsewhere.
import { JOBS } from "@/game/data/tuning";

const RAIDERS = ["rattler", "warlord"];

export const JOB_CATALOG = {
  hunt: { faction: "well", need: "neutral", mech: "count", targets: RAIDERS, rep: 5, from: "Sheriff Bly", line: "Three Rattlers. Wrecked. You know the drill." },
  escort: { faction: "well", need: "neutral", mech: "escort", convoy: true, rep: 6, rival: { raiders: -4 }, from: "Cistern Mother Ilse", line: "Water convoy's rolling for the dam. Keep my tankers breathing and you get paid." },
  bounty: { faction: "well", need: "friendly", mech: "count", targets: RAIDERS, title: "Militia bounty: 5 Rattlers", reward: 900, time: 360, count: 5, rep: 10, rival: { raiders: -6 }, from: "Sheriff Bly", line: "You've earned the big board. Five Rattlers, militia pay." },
  dump: { faction: "gasket", need: "neutral", rep: 6, rival: { raiders: -5 }, from: "Foreman Okafor", line: "Rattlers stacked fuel at the refinery. Light it up." },
  sweep: { faction: "gasket", need: "friendly", mech: "count", targets: RAIDERS, title: "Gasket sweep: 4 Rattlers", reward: 700, time: 300, count: 4, rep: 9, rival: { raiders: -5 }, from: "Foreman Okafor", line: "Gasket trusts you now. Clear four Rattlers off our roads." },
  crash: { faction: "drifters", need: "neutral", rep: 5, from: "Scav Dee", line: "Something fell out of the sky at the crash site. Haul the crate home before the Rattlers do." },
  tower: { faction: "drifters", need: "neutral", rep: 4, from: "Sparks, Radio Tower", line: "Hold the Radio Tower for a minute so I can get the signal out." },
  caravan: { faction: "drifters", need: "friendly", mech: "escort", convoy: true, title: "Escort the Drifter caravan", reward: 650, time: 240, rep: 9, rival: { raiders: -4 }, from: "Scav Dee", line: "Our trade rides with the water convoy today. Keep it rolling and you're family." },
  raid: { faction: "raiders", need: "neutral", mech: "count", targets: ["tanker"], convoy: true, title: "Raid the water convoy", reward: 800, time: 300, count: 1, rep: 10, rival: { well: -8, drifters: -4 }, from: "Mother Hex", line: "Water's rolling to the dam. Crack a tanker and the fence pays double." },
  ambush: { faction: "raiders", need: "neutral", mech: "count", targets: ["drifter"], title: "Ambush 2 Drifters", reward: 500, time: 300, count: 2, rep: 8, rival: { drifters: -6 }, from: "Mother Hex", line: "Drifters think they own the roads. Wreck two of them." },
};

// Title, reward, time, count/hold and the faction data for one kind, or null if unknown.
export function jobDef(kind) {
  const c = JOB_CATALOG[kind];
  if (!c) return null;
  return { kind, mech: kind, ...(JOBS.defs[kind] || {}), ...c };
}

// Does vehicle v count toward a "count" job with these targets?
export function countsFor(def, v) {
  if (!def || def.mech !== "count") return false;
  return def.targets.some((t) => (t === "tanker" ? v.team === "cisterner" && v.chassisId === "tanker" : v.team === t));
}

export const jobKinds = () => Object.keys(JOB_CATALOG);