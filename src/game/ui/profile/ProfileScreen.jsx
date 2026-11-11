import { useEffect, useState } from "react";
import { titleLabel, TRACKS, unlockTier } from "@/game/fame/titles";
import { ICONS, SHAPES, BORDERS } from "@/game/fame/avatar";
import { normalizeTag } from "@/game/fame/tagFilter";
import EmblemPreview from "@/game/ui/profile/EmblemPreview";

export default function ProfileScreen({ game, save, onBack, onSave }) {
  const view = game?.fame?.view?.();
  const [tab, setTab] = useState("overview");
  const [tag, setTag] = useState(save?.profile?.tag || "");
  const [title, setTitle] = useState(save?.profile?.equippedTitle || "overall:1");
  const [avatar, setAvatar] = useState({ ...(save?.profile?.avatar || {}) });

  useEffect(() => {
    setTag(save?.profile?.tag || "");
    setTitle(save?.profile?.equippedTitle || "overall:1");
    setAvatar({ ...(save?.profile?.avatar || {}) });
  }, [save]);

  if (!view) return null;
  const tier = unlockTier(view.fame);

  const commit = () => {
    game.fame.setTag(normalizeTag(tag));
    game.fame.equipTitle(title);
    game.fame.setAvatar(avatar);
    onSave?.();
  };

  const allTitles = [];
  for (let i = 1; i <= 10; i++) allTitles.push(`overall:${i}`);
  for (const tr of TRACKS) for (let i = 1; i <= 10; i++) allTitles.push(`${tr.id}:${i}`);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(12,8,5,0.94)] p-4 text-[#e9dcc4]">
      <div className="sw-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="sw-display text-3xl text-[#f2c230]">Driver profile</h2>
            <p className="text-xs uppercase tracking-[0.25em] text-[#a8987f] mt-1">
              {titleLabel(`overall:${view.overall}`)} · rank {view.overall} · {view.total} fame
            </p>
          </div>
          <EmblemPreview avatar={avatar} size={72} className="rounded border border-[#5a1e08]/60" />
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {["overview", "titles", "emblem"].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`sw-btn text-xs px-3 py-1 ${tab === t ? "sw-btn-primary" : ""}`}>{t}</button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="grid gap-3 md:grid-cols-2">
            {view.tracks.map((t) => (
              <div key={t.id} className="rounded border border-[#5a1e08]/40 p-3">
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: t.color }}>{t.name}</span>
                  <span>Rank {t.rank} · {t.points} pts</span>
                </div>
                <div className="h-2 bg-[#1a1410] rounded overflow-hidden">
                  <div className="h-full bg-[#f2c230]" style={{ width: `${Math.round(t.pct * 100)}%` }} />
                </div>
                <div className="text-[10px] text-[#8a7d6a] mt-1">{titleLabel(`${t.id}:${t.rank}`)}</div>
              </div>
            ))}
          </div>
        )}
        {tab === "titles" && (
          <div className="grid gap-1 max-h-64 overflow-y-auto text-sm">
            {allTitles.map((id) => {
              const on = view.unlocked.includes(id);
              return (
                <button key={id} type="button" disabled={!on} onClick={() => setTitle(id)}
                  className={`text-left px-2 py-1 rounded ${on ? "hover:bg-[#2a2018]" : "opacity-40"} ${title === id ? "ring-1 ring-[#f2c230]" : ""}`}>
                  {on ? "✓" : "—"} {titleLabel(id)}
                </button>
              );
            })}
          </div>
        )}
        {tab === "emblem" && (
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <label className="block">Shape
              <select className="sw-input w-full mt-1" value={avatar.shape} onChange={(e) => setAvatar((a) => ({ ...a, shape: e.target.value }))}>
                {SHAPES.filter((s) => s.min <= tier).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="block">Border
              <select className="sw-input w-full mt-1" value={avatar.border} onChange={(e) => setAvatar((a) => ({ ...a, border: e.target.value }))}>
                {BORDERS.filter((b) => b.min <= tier).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
            <label className="block md:col-span-2">Icon
              <select className="sw-input w-full mt-1" value={avatar.icon} onChange={(e) => setAvatar((a) => ({ ...a, icon: +e.target.value }))}>
                {ICONS.filter((i) => i.min <= tier).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <label className="block">Colour
              <input type="color" className="w-full h-10 mt-1" value={avatar.color || "#c7762e"} onChange={(e) => setAvatar((a) => ({ ...a, color: e.target.value }))} />
            </label>
            <label className="block">Accent
              <input type="color" className="w-full h-10 mt-1" value={avatar.color2 || "#3a3734"} onChange={(e) => setAvatar((a) => ({ ...a, color2: e.target.value }))} />
            </label>
          </div>
        )}
        <label className="block mt-4 text-sm">Tag (14 chars)
          <input className="sw-input w-full mt-1" maxLength={14} value={tag} onChange={(e) => setTag(e.target.value)} />
        </label>
        <div className="flex gap-3 mt-5">
          <button type="button" className="sw-btn sw-btn-primary" onClick={commit}>Save profile</button>
          <button type="button" className="sw-btn" onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
