import TraderMenu from "@/game/ui/factions/TraderMenu";
import MapScreen from "@/game/ui/factions/MapScreen";

// The round 11 screens GameRoot shows: the Trader menu (phase "trader") and the map (phase "map").
export default function FactionScreens({ phase, game, trader, online, onClose }) {
  if (!game) return null;
  if (phase === "trader" && trader) return <TraderMenu key={trader.id} game={game} postId={trader.id} tab={trader.tab} online={online} onClose={onClose} />;
  if (phase === "map") return <MapScreen game={game} online={online} onClose={onClose} />;
  return null;
}