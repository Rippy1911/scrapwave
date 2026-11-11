import { useEffect, useState } from "react";

// The lobby's state for React: re-reads on every lobby change and once a second (pings, list expiry).
export default function useLobby(game) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!game || !game.lobby) return undefined;
    const off = game.lobby.subscribe(() => tick((x) => x + 1));
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => { off(); clearInterval(t); };
  }, [game]);
  return game && game.lobby ? game.lobby.state() : null;
}