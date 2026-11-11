import { useEffect, useRef, useState } from "react";
import { PARENT } from "@/game/ui/play/menuGraph";
import { net } from "@/game/net/net";

// Back-stack navigation for the menus under the title. menu = { screen, kind } (kind: the map picker's mode).
// from: the menu screen a game was launched from, so "Back to menu" returns there.
export default function useMenuNav({ gameRef, phase, setPhase }) {
  const [menu, setMenu] = useState({ screen: "title", kind: null });
  const fromRef = useRef(menu);
  const go = (screen, kind = null) => setMenu({ screen, kind });
  const back = () => setMenu((m) => ({ screen: PARENT[m.screen] || "title", kind: m.kind }));

  // Esc is Back on every menu screen below the title.
  useEffect(() => {
    if (phase !== "title" || menu.screen === "title") return;
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); back(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, menu.screen]);

  return {
    menu, go, back,
    markLaunch() { fromRef.current = menu; },
    // Out of play to a menu: the arena closes, online drops to offline, then the menu shows over the world.
    toMenu(screen = null, kind = null) {
      const g = gameRef.current;
      if (g.game.arena.active) g.leaveArena();
      if (net.mode === "online") { g.game.netSync.stop(); net.goOffline(); }
      setMenu(screen ? { screen, kind } : fromRef.current);
      setPhase("title");
    },
  };
}