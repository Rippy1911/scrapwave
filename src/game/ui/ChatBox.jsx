import { useState } from "react";

// Chat log (last lines, fade after 10 s) and the Enter-to-type box.
export default function ChatBox({ lines, open, onSend, onClose }) {
  const [text, setText] = useState("");
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); setText(""); onClose(); }
    if (e.key === "Enter") { e.preventDefault(); if (text.trim()) onSend(text); setText(""); onClose(); }
  };
  return (
    <div className="pointer-events-none fixed bottom-40 left-4 w-[min(420px,90vw)] sw-body flex flex-col gap-1">
      {lines.map((l) => (
        <div key={l.id} className="sw-slide w-fit max-w-full rounded-sm bg-[rgba(18,14,10,0.65)] px-2 py-0.5 text-sm text-[#efe3cb]">
          <span className={l.me ? "font-bold text-[#7fe0a0]" : "font-bold text-[#f2c230]"}>{l.name}:</span> {l.text}
        </div>
      ))}
      {open && (
        <input autoFocus maxLength={120} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} onBlur={onClose}
          placeholder="Say something · Enter to send · Esc to cancel"
          className="pointer-events-auto mt-1 rounded-sm border-2 border-[#57503f] bg-[rgba(18,14,10,0.9)] px-2 py-1 text-sm text-[#f2e6c8] outline-none focus:border-[#f2c230]" />
      )}
    </div>
  );
}