const ROWS = [
  ["W / S", "Throttle · brake / reverse"], ["A / D", "Steer"], ["Space", "Handbrake · in air: level out"],
  ["Shift / RMB", "Turbo"], ["LMB / J", "Fire guns"], ["F / K", "Rocket salvo (K: harpoon if no rockets)"], ["E", "Harpoon"],
  ["Esc · Loadout", "Rebind each weapon mount · key legend on or off"],
  ["Mouse", "Look / aim · locks the target nearest the crosshair"], ["Tab", "Tap: next target · hold: scoreboard"],
  ["W / S in air", "Pitch · flips"], ["A / D in air", "Roll · barrel rolls"], ["Q / E in air", "Spin"], ["R (hold)", "Reset upright"],
  ["G", "Drop trap (oil · spikes · mines)"], ["H", "Cycle trap"], ["U", "Upgrade traps (at an outpost)"],
  ["B", "Garage (in town)"], ["V", "Smoke (module) · instant replay"], ["N", "Horn"],
  ["Stop at pumps", "Refuel · red cans add fuel"], ["C", "Camera distance"], ["Esc", "Pause · skip replay"],
  ["Stop at a beacon 5 s", "Claim a plot"], ["B on your plot", "Build view · R rotate · Esc leave"], ["L", "Take a radio job"],
  ["Enter", "Chat (online)"], ["T", "Emote wheel · 1-4"],
  ["E (stopped, safe zone)", "Get out · on foot: get in / use"], ["On foot", "WASD walk · Shift run · Space jump"], ["Z on foot", "Summon a garage car"],
];

export default function ControlsList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
      {ROWS.map(([k, d]) => (
        <div key={k} className="flex items-center gap-3">
          <span className="min-w-[96px] text-center rounded-sm border border-[#57503f] bg-[#26231f] px-2 py-0.5 text-xs text-[#f2c230] uppercase tracking-wider">{k}</span>
          <span className="text-[#d8cbb2]">{d}</span>
        </div>
      ))}
      <div className="sm:col-span-2 mt-2 text-xs text-[#a8987f]">Gamepad supported: RT/LT drive, RB turbo, X fire, D-pad up rockets, B harpoon, A handbrake, D-pad down drop trap, D-pad left cycle trap, D-pad right next target.</div>
    </div>
  );
}