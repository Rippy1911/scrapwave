import { useEffect, useRef, useState } from "react";

// The lobby's short chat: the last lines and a box to send one (Enter sends).
export default function LobbyChat({ lines, onSend }) {
  const [text, setText] = useState("");
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [lines.length]);
  const send = () => { if (text.trim()) { onSend(text); setText(""); } };
  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Chat</div>
      <div className="h-28 overflow-y-auto bg-[#141210] border border-[#3a362f] px-2 py-1 text-sm">
        {lines.length ? lines.map((l, i) => (
          <div key={l.at + "-" + i} className="leading-snug"><span className="sw-display text-xs text-[#f2c230]">{l.name}</span> <span className="text-[#e9dcc4]">{l.text}</span></div>
        )) : <div className="text-xs text-[#7d7262]">Say hello.</div>}
        <div ref={end} />
      </div>
      <div className="flex gap-1.5">
        <input value={text} maxLength={100} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message" className="flex-1 bg-[#141210] border border-[#57503f] px-2 py-1 text-sm text-[#f4ead6]" />
        <button onClick={send} className="sw-btn px-3 text-xs">Send</button>
      </div>
    </div>
  );
}