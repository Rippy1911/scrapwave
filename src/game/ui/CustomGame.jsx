import { useState } from "react";
import { FIELDS, validateRules } from "@/game/rules/gameRules";
import { PRESETS } from "@/game/rules/presets";
import { getRules, loadCustom, saveCustom, deleteCustom } from "@/game/rules/state";
import { shareUrl } from "@/game/rules/share";
import RuleField from "@/game/ui/RuleField";
import MapBuilder from "@/game/ui/mapbuilder/MapBuilder";

const ARENA_ONLY = new Set(["map", "win", "laps", "timeLimit", "powerups", "horde", "hordeDensity"]);
const ROAM_ONLY = new Set(["building", "freeBuild", "raids"]);

// Custom Game: pick a preset or one of yours, tune every rule, save it, share it as a link, play it.
export default function CustomGame({ onPlay, onClose, onHost, onFind }) {
  const [draft, setDraft] = useState(() => ({ ...getRules() }));
  const [mine, setMine] = useState(() => loadCustom());
  const [msg, setMsg] = useState("");
  const [builder, setBuilder] = useState(false);
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2200); };
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const pick = (r) => setDraft({ ...validateRules(r) });
  const save = () => { const r = saveCustom(draft); setDraft({ ...r }); setMine(loadCustom()); flash(`Saved "${r.name}"`); };
  const remove = (name) => { deleteCustom(name); setMine(loadCustom()); };
  const share = async () => {
    const url = shareUrl(draft);
    try { await navigator.clipboard.writeText(url); flash("Share link copied"); } catch { window.prompt("Copy this link", url); }
  };
  const host = () => {
    if (draft.mode === "arena" && draft.map === "custom") { flash("Your own maps are single player for now"); return; }
    onHost(validateRules(draft));
  };
  if (builder) return <MapBuilder onClose={() => setBuilder(false)} onPlay={() => onPlay(validateRules({ ...draft, mode: "arena", map: "custom" }))} />;
  const fields = FIELDS.filter((f) => !(draft.mode === "arena" ? ROAM_ONLY : ARENA_ONLY).has(f.key));
  const chip = (r, key, own) => (
    <div key={key} className={`flex items-center justify-between gap-1 px-2 py-1 text-sm ${draft.name === r.name ? "bg-[#3a3122] text-[#f2c230]" : "text-[#e9dcc4] hover:bg-[#25211c]"}`}>
      <button onClick={() => pick(r)} className="flex-1 text-left truncate">{r.name}</button>
      {own && <button onClick={() => remove(r.name)} className="text-xs text-[#a8987f] hover:text-[#ff6a4a]">✕</button>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(12,8,5,0.8)] p-3 sw-body text-[#e9dcc4]">
      <div className="sw-panel sw-slide w-full max-w-4xl max-h-[92vh] flex flex-col px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#5a1e08]">CUSTOM GAME</div>
          {msg && <div className="text-xs uppercase tracking-[0.2em] text-[#7fe0a0]">{msg}</div>}
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <div className="md:w-48 shrink-0 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f] mb-1">Presets</div>
            {PRESETS.map((p) => chip({ ...p.patch, name: p.name }, "b" + p.name, false))}
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f] mt-3 mb-1">Yours</div>
            {mine.length ? mine.map((r) => chip(r, "m" + r.name, true)) : <div className="px-2 text-xs text-[#7d7262]">None saved yet</div>}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <label className="flex flex-col gap-1 mb-3">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Name</span>
              <input value={draft.name} maxLength={32} onChange={(e) => set("name", e.target.value)} className="bg-[#141210] border border-[#57503f] px-2 py-1 text-sm text-[#f4ead6]" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => <RuleField key={f.key} f={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} />)}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="sw-btn px-4 py-2 text-sm">Back</button>
          <button onClick={share} className="sw-btn px-4 py-2 text-sm">Copy share link</button>
          <button onClick={save} className="sw-btn px-4 py-2 text-sm">Save preset</button>
          <button onClick={onFind} className="sw-btn px-4 py-2 text-sm">Find a game</button>
          <button onClick={() => setBuilder(true)} className="sw-btn px-4 py-2 text-sm">Map builder</button>
          <button onClick={host} className="sw-btn px-4 py-2 text-sm">Host lobby</button>
          <button onClick={() => onPlay(validateRules(draft))} className="sw-btn sw-btn-primary px-6 py-2 text-sm">Play</button>
        </div>
      </div>
    </div>
  );
}