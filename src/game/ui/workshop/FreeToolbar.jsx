// Free-build toolbar: tools, Drive / Walker view, symmetry and fine snapping, rotate, mirror, copy / paste,
// delete, undo / redo, and the part count against the cap.
const B = ({ on, onClick, children, disabled, title }) => (
  <button type="button" title={title} disabled={disabled} onClick={onClick} className={`sw-btn px-2 py-1 text-[10px] disabled:opacity-40 ${on ? "sw-btn-primary" : ""}`}>{children}</button>
);

export default function FreeToolbar({ ed }) {
  const { opt, setOpt, ops, sel, clip, sizes, count, cap } = ed, one = sel.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {["place", "select", "move"].map((t) => <B key={t} on={opt.tool === t} onClick={() => setOpt({ tool: t })}>{t}</B>)}
      <span className="mx-1 h-5 w-px bg-[#46413a]" />
      <B on={opt.mode === "drive"} onClick={() => setOpt({ mode: "drive" })}>Drive</B>
      <B on={opt.mode === "walk"} onClick={() => setOpt({ mode: "walk" })}>Walker</B>
      <span className="mx-1 h-5 w-px bg-[#46413a]" />
      <B on={opt.sym} onClick={() => setOpt({ sym: !opt.sym })} title="Parts off the centre line get a mirrored twin">Symmetry</B>
      <B on={opt.fine} onClick={() => setOpt({ fine: !opt.fine })} title="0.05 m snapping, 15° turns">Fine</B>
      <span className="mx-1 h-5 w-px bg-[#46413a]" />
      {["x", "y", "z"].map((a) => <B key={a} disabled={!one} onClick={() => ops.rotate(a)}>Rot {a.toUpperCase()}</B>)}
      <B disabled={!one} onClick={ops.mirror}>Mirror</B>
      <B disabled={!one} onClick={ops.copy}>Copy</B>
      <B disabled={!clip} onClick={() => ops.paste()}>Paste</B>
      <B disabled={!one} onClick={ops.remove}>Delete</B>
      <B disabled={!sizes.undo} onClick={ops.undo}>Undo</B>
      <B disabled={!sizes.redo} onClick={ops.redo}>Redo</B>
      <span className={`ml-auto text-[11px] uppercase tracking-wider ${count >= cap ? "text-[#ff8a6a]" : "text-[#a8987f]"}`}>{count} / {cap} parts</span>
    </div>
  );
}