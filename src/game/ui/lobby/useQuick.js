import { useEffect, useState } from "react";

// Quick play's state for React: re-reads on every change.
export default function useQuick(game) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!game || !game.quick) return undefined;
    return game.quick.subscribe(() => tick((x) => x + 1));
  }, [game]);
  return game && game.quick ? game.quick.state() : null;
}
