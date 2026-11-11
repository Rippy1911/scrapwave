import { useEffect } from "react";
import useLobby from "@/game/ui/lobby/useLobby";
import LobbyBrowser from "@/game/ui/lobby/LobbyBrowser";
import HostForm from "@/game/ui/lobby/HostForm";
import LobbyRoom from "@/game/ui/lobby/LobbyRoom";
import LobbyResults from "@/game/ui/lobby/LobbyResults";
import LobbyBar from "@/game/ui/lobby/LobbyBar";
import QuickCard from "@/game/ui/lobby/QuickCard";
import useQuick from "@/game/ui/lobby/useQuick";

// Every lobby screen. onPhase tells the shell what to show: "lobby" while a lobby screen is open, "playing"
// during a lobby match, and where to go after leaving ("title" or "playing"). quick: { retry, offline } for Quick play.
export default function LobbyScreens({ game, save, driver, phase, onPhase, quick }) {
  const s = useLobby(game);
  const q = useQuick(game);
  const want = !s ? null : s.screen ? "lobby" : s.lobby ? "playing" : s.leftTo;
  useEffect(() => { if (want) onPhase(want); }, [want]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  const L = game.lobby;
  const wrap = (el) => <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(12,8,5,0.8)] p-3 sw-body text-[#e9dcc4]">{el}</div>;
  if (q && q.active) return wrap(<QuickCard q={q} onCancel={() => { game.quick.cancel(); onPhase("title"); }} onRetry={quick.retry} onOffline={quick.offline} />);
  if (s.screen === "browse") return wrap(<LobbyBrowser s={s} onJoin={(q, code) => L.join(q, code)} onBack={() => L.closeScreen()} />);
  if (s.screen === "hostForm" && s.draft) return wrap(<HostForm rules={s.draft} driver={driver} busy={s.busy} error={s.error} onHost={(o) => L.host(s.draft, o)} onBack={() => L.closeScreen()} />);
  if (s.screen === "room" && s.lobby) return wrap(<LobbyRoom s={s} save={save} L={L} />);
  if (s.screen === "results" && s.lobby) return wrap(<LobbyResults s={s} L={L} />);
  if (s.lobby && s.lobby.phase === "match" && phase === "playing") return <LobbyBar s={s} L={L} />;
  return null;
}