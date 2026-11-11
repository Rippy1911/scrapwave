import { useState } from "react";
import { Link2 } from "lucide-react";
import { describeRules } from "@/game/lobby/describe";

// Lobby name, mode and map, the join code and a copy-link button.
export default function LobbyHeader({ s }) {
  const l = s.lobby, d = describeRules(l.rules);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(s.link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("Copy this link", s.link); }
  };
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate sw-display text-3xl text-[#f2c230] drop-shadow-[0_3px_0_#5a1e08]">{l.name}</div>
        <div className="text-xs uppercase tracking-[0.2em] text-[#a8987f]">{d.mode} · {d.map}{s.role === "host" ? " · you host" : ""}</div>
      </div>
      <div className="flex items-center gap-2">
        {l.code && <div className="border border-[#57503f] bg-[#141210] px-2 py-1 sw-display text-sm tracking-[0.3em] text-[#f4ead6]">{l.code}</div>}
        <button onClick={copy} className="sw-btn flex items-center gap-1.5 px-3 py-1.5 text-xs"><Link2 className="h-3.5 w-3.5" />{copied ? "Copied" : "Invite link"}</button>
      </div>
    </div>
  );
}