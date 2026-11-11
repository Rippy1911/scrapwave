// Getting this browser onto the room server for a lobby (the shard of a share link when one is given).
import { net } from "@/game/net/net";
import { getDriverName, helloFor } from "@/game/net/driver";

export const driverName = () => getDriverName() || "Driver";

// true once online (in the wanted shard when the server had a seat there), false when the server is unreachable.
export async function ensureOnline(game, shard = null) {
  if (net.mode === "online") {
    const here = net.impl().shard ? net.impl().shard() : null;
    if (!shard || here === shard) return true;
    game.netSync.stop(); // switch shards: the lobby lives in the share link's shard
    net.goOffline();
  }
  return !!(await net.goOnline({ ...helloFor(game.save, driverName()), shard }));
}

export const shardNow = () => (net.mode === "online" && net.impl().shard ? net.impl().shard() : null);