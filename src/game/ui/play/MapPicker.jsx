import { useState } from "react";
import MenuShell from "@/game/ui/menu/MenuShell";
import { MAP_KINDS, mapsFor } from "@/game/maps/catalog";
import { ARENA_RULES } from "@/game/ui/play/menuGraph";
import MapPicture from "@/game/ui/play/MapPicture";
import "@/game/maps/worlds";
import { wantRoam } from "@/game/maps/ashmark/maps";
import { DEFAULT_RULES, validateRules } from "@/game/rules/gameRules";
import { presetPatch } from "@/game/rules/presets";

const chip = (on) => `sw-btn px-3 py-1 text-xs ${on ? "text-[#f2c230] border-[#8a6a1e]" : ""}`;

// One picker per mode: map cards, the mode's rule chips, Start. onStart({ online, rules }).
export default function MapPicker({ kind, onStart, onBack }) {
  const maps = mapsFor(kind);
  const [mapId, setMapId] = useState(maps[0].id);
  const [rule, setRule] = useState(ARENA_RULES[0]);
  const [laps, setLaps] = useState(null);
  const map = maps.find((m) => m.id === mapId) || maps[0];
  const lapCount = laps || map.laps || 3;
  const start = () => {
    if (kind === "roam") {
      if (map.build) return onStart({ rules: validateRules({ ...DEFAULT_RULES, ...map.roamRules, name: `Free Roam · ${map.name}`, map: map.id }) });
      wantRoam(map.id); return onStart({ online: !!map.online }); // the Ashmark takes the wish at session start
    }
    const patch = kind === "race" ? { ...presetPatch("Wreck Race · Foundry Pen"), name: `Wreck Race · ${map.name}`, laps: lapCount } : presetPatch(rule);
    onStart({ rules: validateRules({ ...DEFAULT_RULES, ...patch, map: map.id }) });
  };
  const actions = (
    <>
      <button type="button" onClick={onBack} className="sw-btn px-4 py-2 text-sm">Back</button>
      <button type="button" onClick={start} className="sw-btn sw-btn-primary px-6 py-2 text-base">Start</button>
    </>
  );
  return (
    <MenuShell title={MAP_KINDS[kind].toUpperCase()} sub="Pick a map · Esc goes back" actions={actions} wide>
      <div className="grid gap-2 md:grid-cols-3">
        {maps.map((m) => (
          <button key={m.id} type="button" onClick={() => setMapId(m.id)} className={`sw-panel p-3 text-left transition-colors ${m.id === map.id ? "border-[#f2c230]" : "hover:border-[#8a6a1e]"}`}>
            <MapPicture id={m.id} className="mb-2" />
            <div className="sw-display text-base text-[#f4ead6]">{m.name}</div>
            <div className="mt-1 text-xs text-[#a8987f]">{m.blurb}</div>
          </button>
        ))}
      </div>
      {kind === "arena" && (
        <div className="flex flex-wrap gap-2">{ARENA_RULES.map((r) => <button key={r} type="button" onClick={() => setRule(r)} className={chip(r === rule)}>{r}</button>)}</div>
      )}
      {kind === "race" && (
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#a8987f]">
          Laps {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setLaps(n)} className={chip(n === lapCount)}>{n}</button>)}
        </div>
      )}
    </MenuShell>
  );
}