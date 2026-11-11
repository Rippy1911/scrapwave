import { useState } from "react";

// A button that asks once, inside the page: the first press turns it into "sure? Yes / No". No browser dialog.
export default function ConfirmButton({ label, ask = "Sure?", yes = "Yes", onConfirm, className = "sw-btn px-4 py-2 text-sm" }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" onClick={() => setAsking(true)} className={className}>{label}</button>;
  return (
    <span className="flex items-center gap-1.5 rounded-sm border-2 border-[#ff6a4a] bg-[#2a1712] px-2 py-1" role="alertdialog" aria-label={ask}>
      <span className="text-xs uppercase tracking-[0.15em] text-[#ffb39a]">{ask}</span>
      <button type="button" autoFocus onClick={() => { setAsking(false); onConfirm(); }} className="sw-btn sw-btn-primary px-3 py-1.5 text-xs">{yes}</button>
      <button type="button" onClick={() => setAsking(false)} className="sw-btn px-3 py-1.5 text-xs">No</button>
    </span>
  );
}