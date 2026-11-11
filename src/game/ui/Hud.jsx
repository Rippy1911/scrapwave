import Minimap from "@/game/ui/Minimap";
import TrackMap from "@/game/ui/race/TrackMap";
import LapCard from "@/game/ui/race/LapCard";
import HudBars from "@/game/ui/HudBars";
import Crosshair from "@/game/ui/Crosshair";
import ThreatIndicators from "@/game/ui/ThreatIndicators";
import Scoreboard from "@/game/ui/Scoreboard";
import NetPill from "@/game/ui/NetPill";
import CycleClock from "@/game/ui/CycleClock";
import JobCard from "@/game/ui/JobCard";
import FortCard from "@/game/ui/FortCard";
import BaseAlert from "@/game/ui/BaseAlert";
import ArenaCard from "@/game/ui/ArenaCard";
import FlightHud from "@/game/air/ui/FlightHud";
import LockMarker from "@/game/ui/LockMarker";
import TrapShopCard from "@/game/ui/TrapShopCard";
import SafeZoneBanner from "@/game/ui/SafeZoneBanner";
import FootPrompt from "@/game/ui/FootPrompt";
import FootHud from "@/game/ui/foot/FootHud";
import MechHud from "@/game/ui/MechHud";
import KeyLegend from "@/game/ui/KeyLegend";

// In-game overlay: bars, speed, scrap, weapons, crosshair, threats, lock target, prompts, minimap, scoreboard.
export default function Hud({ hud, hitAt }) {
  if (!hud) return null;
  const hitRecent = hitAt && performance.now() - hitAt < 160;
  if (hud.build) {
    return (
      <div className="pointer-events-none fixed inset-0 sw-body text-[#efe3cb] select-none">
        <CycleClock cycle={hud.cycle} storm={hud.storm} />
        <BaseAlert alert={hud.alert} myBase={hud.myBase} />
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-0 sw-body text-[#efe3cb] select-none">
      {hud.arena ? <ArenaCard arena={hud.arena} /> : (
        <>
          <CycleClock cycle={hud.cycle} storm={hud.storm} />
          <BaseAlert alert={hud.alert} claim={hud.claim} prompt={hud.prompt} myBase={hud.myBase} padRepair={hud.padRepair} />
          <JobCard jobs={hud.jobs} />
          <FortCard fort={hud.fort} />
        </>
      )}
      {!hud.intro && !hud.autopilot && !(hud.foot && hud.foot.on) && <Crosshair lock={!!hud.lock || !!(hud.aim && hud.aim.locked)} hitRecent={hitRecent} free={hud.aimFree} />}
      <LockMarker />
      {!hud.intro && hud.alive && !hud.autopilot && !hud.flight && !(hud.foot && hud.foot.on) && <KeyLegend hud={hud} />}
      <TrapShopCard traps={hud.traps} />
      <ThreatIndicators threats={hud.threats} lockedOn={hud.lockedOn} />
      <FlightHud air={hud.flight} />
      {hud.alive && !(hud.foot && hud.foot.on) && <MechHud mech={hud.mech} />}

      {hud.lock && (
        <div className="absolute left-1/2 top-[132px] -translate-x-1/2 w-64 sw-panel px-4 py-2">
          <div className="flex justify-between text-xs uppercase tracking-[0.2em]"><span className="text-[#ff8a6a]">{hud.lock.name}</span><span className="text-[#a8987f]">{hud.lock.skill}</span></div>
          <div className="mt-1 h-2 bg-[#0e0c0a]"><div className="h-full bg-[#ff4a2a]" style={{ width: `${hud.lock.hull * 100}%` }} /></div>
        </div>
      )}

      <div className="sw-hud-loc absolute left-4 top-4 flex flex-col gap-2">
        <div className="sw-display text-lg text-[#f2c230] tracking-wider drop-shadow-[0_2px_0_#000]">{hud.location}</div>
        <NetPill net={hud.net} />
        {hud.autopilot && <div className="inline-block w-fit rounded-sm bg-[#5d8fd6] px-2 py-0.5 text-[11px] font-bold tracking-[0.25em] text-[#0e1420]">AUTOPILOT</div>}
        {hud.near > 0 && !hud.safe && <div className="text-xs uppercase tracking-[0.25em] text-[#ff8a6a] sw-pulse">{hud.near} Rattler{hud.near > 1 ? "s" : ""} close</div>}
      </div>

      <div className="sw-hud-map absolute right-4 top-4">
        {hud.race ? <><TrackMap race={hud.race} x={hud.x} z={hud.z} /><LapCard race={hud.race} /></> : <Minimap hud={hud} />}
      </div>

      <SafeZoneBanner zone={hud.zone} garage={hud.garage} onFoot={hud.foot && hud.foot.on} />
      {hud.alive && <FootPrompt foot={hud.foot} />}

      {hud.air > 0 && <div className="absolute left-1/2 top-[30%] -translate-x-1/2 sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#5a1e08]">{hud.air.toFixed(1)}s</div>}

      {!hud.intro && <HudBars hud={hud} />}
      {!hud.intro && <FootHud foot={hud.foot} hitRecent={hitRecent} legendOn={hud.legendOn} />}
      <Scoreboard rows={hud.scoreboard} />

      {!hud.alive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(30,8,4,0.45)]">
          <div className="sw-display text-6xl text-[#ff4a2a] drop-shadow-[0_4px_0_#000]">WRECKED</div>
          <div className="mt-3 text-sm uppercase tracking-[0.3em] text-[#e9dcc4]">Choose your ride in {Math.ceil(hud.respawnIn)}</div>
          <div className="text-xs text-[#a8987f] mt-1">Unbanked scrap was spilled</div>
        </div>
      )}
    </div>
  );
}