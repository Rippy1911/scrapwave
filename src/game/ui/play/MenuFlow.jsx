import TitleScreen from "@/game/ui/TitleScreen";
import PlayMenu from "@/game/ui/play/PlayMenu";
import MapPicker from "@/game/ui/play/MapPicker";
import SettingsMenu from "@/game/ui/play/SettingsMenu";
import CustomGame from "@/game/ui/CustomGame";
import Workshop from "@/game/ui/workshop/Workshop";
import ProfileScreen from "@/game/ui/profile/ProfileScreen";

// Every menu under the title, one at a time, from nav.menu (useMenuNav). onLaunch({ online, rules }) starts play.
export default function MenuFlow({ nav, save, handle, attract, driver, onLaunch, onQuick, onDemo, onFind, onHost, onQuality, onVolume, onRename, onSave }) {
  const { screen, kind } = nav.menu;
  if (screen === "play") return <PlayMenu onBack={nav.back} onPick={(id) => (id === "custom" ? nav.go("custom") : id === "lobbies" ? onFind() : nav.go("maps", id))} />;
  if (screen === "maps") return <MapPicker key={kind} kind={kind} onStart={onLaunch} onBack={nav.back} />;
  if (screen === "custom") return <CustomGame onPlay={(r) => onLaunch({ rules: r })} onClose={nav.back} onHost={onHost} onFind={onFind} />;
  if (screen === "workshop") return <Workshop save={save} game={handle.game} onClose={nav.back} />;
  if (screen === "settings") return <SettingsMenu save={save} handle={handle} onQuality={onQuality} onVolume={onVolume} driver={driver} onRename={onRename} onBack={nav.back} />;
  if (screen === "profile") return <ProfileScreen game={handle?.game} save={save} onBack={nav.back} onSave={onSave} />;
  return <TitleScreen save={save} attract={attract} onPlayNow={onQuick} onGo={nav.go} onDemo={onDemo} />;
}