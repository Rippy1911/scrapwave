import MechCheckLast from "@/game/ui/MechCheckLast";
import RaceCheckCard from "@/game/ui/race/RaceCheckCard";
import BigCheckCard from "@/game/ui/BigCheckCard";

// The on-screen cards of the scripted checks: ?mechcheck=1 and ?racecheck=1.
export default function CheckCards({ modes, hud }) {
  return (
    <>
      {modes.mechcheck && <MechCheckLast live={hud && hud.mech && hud.mech.check} />}
      {modes.racecheck && <RaceCheckCard />}
      {modes.bigcheck && <BigCheckCard />}
    </>
  );
}