import MenuShell from "@/game/ui/menu/MenuShell";
import { PLAY_ROWS } from "@/game/ui/play/menuGraph";

// Play: one row per way to play. onPick(id): roam / arena / race open the map picker, custom and lobbies their screens.
export default function PlayMenu({ onPick, onBack }) {
  return (
    <MenuShell title="PLAY" sub="Pick how you want to drive · Esc goes back" actions={<button type="button" onClick={onBack} className="sw-btn px-4 py-2 text-sm">Back</button>}>
      <div className="grid gap-2 md:grid-cols-2">
        {PLAY_ROWS.map((r) => (
          <button key={r.id} type="button" onClick={() => onPick(r.id)} className="sw-btn px-4 py-3 text-left normal-case">
            <div className="text-lg uppercase">{r.label}</div>
            <div className="sw-body text-xs tracking-normal text-[#a8987f]">{r.sub}</div>
          </button>
        ))}
      </div>
    </MenuShell>
  );
}