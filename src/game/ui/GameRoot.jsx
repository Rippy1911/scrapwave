import { useCallback, useEffect, useRef, useState } from "react";
import { createGame } from "@/game/game/game";
import { loadSave, writeSave } from "@/game/core/save";
import { readModes, seedRandom } from "@/game/game/modes";
import { FLOW, QUALITY } from "@/game/data/tuning";
import BootSplash from "@/game/ui/BootSplash";
import PauseMenu from "@/game/ui/PauseMenu";
import Garage from "@/game/ui/Garage";
import Hud from "@/game/ui/Hud";
import Callouts from "@/game/ui/Callouts";
import HintCard from "@/game/ui/HintCard";
import DebugOverlay from "@/game/ui/DebugOverlay";
import useAttract from "@/game/ui/useAttract";
import RadioLine from "@/game/ui/RadioLine";
import ReplayUi from "@/game/ui/ReplayUi";
import DemoBadge from "@/game/ui/DemoBadge";
import { detectQuality } from "@/game/core/detectQuality";
import { net } from "@/game/net/net";
import { getDriverName, setDriverName, helloFor } from "@/game/net/driver";
import NameCard from "@/game/ui/NameCard";
import ConnectingCard from "@/game/ui/ConnectingCard";
import ChatBox from "@/game/ui/ChatBox";
import EmoteWheel from "@/game/ui/EmoteWheel";
import BuildBar from "@/game/ui/BuildBar";
import Results from "@/game/ui/Results";
import ArenaResults from "@/game/ui/ArenaResults";
import MenuFlow from "@/game/ui/play/MenuFlow";
import MapLoading from "@/game/ui/play/MapLoading";
import useMapLoading from "@/game/ui/play/useMapLoading";
import useMenuNav from "@/game/ui/play/useMenuNav";
import { nextMap } from "@/game/maps/catalog";
import AdminLayer from "@/game/ui/admin/AdminLayer";
import SpawnMenu from "@/game/ui/SpawnMenu";
import { setRules, getRules, findPreset } from "@/game/rules/state";
import { decodeRules } from "@/game/rules/share";
import { bootMapRules } from "@/game/maps/bootMap";
import { DEFAULT_RULES } from "@/game/rules/gameRules";
import CheckCards from "@/game/ui/CheckCards";
import TouchControls from "@/game/ui/touch/TouchControls";
import RotateCard from "@/game/ui/touch/RotateCard";
import { isCoarsePointer } from "@/game/ui/touch/detect";
import FactionScreens from "@/game/ui/factions/FactionScreens";
import { menuFreezes, isMenu } from "@/game/ui/menuPause";
import LobbyScreens from "@/game/ui/lobby/LobbyScreens";
import { linkedLobby } from "@/game/lobby/session";
import ExtrasLayer from "@/game/ui/ExtrasLayer";
import { lockPointer } from "@/game/ui/pointerLock";
import { storageOk } from "@/game/core/safeStorage";
import useUiClicks from "@/game/ui/useUiClicks";
import RankUpPopup from "@/game/ui/profile/RankUpPopup";

let uid = 1;

// React shell: owns the canvas, menus and HUD; the game itself lives outside React state.
export default function GameRoot() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const phaseRef = useRef("loading");
  const lockedRef = useRef(false);
  const demoFromRef = useRef("title");
  const [phase, setPhaseState] = useState("loading");
  const [progress, setProgress] = useState({ p: 0.2, msg: "Starting engine..." });
  const [hud, setHud] = useState(null);
  const [big, setBig] = useState([]);
  const [feed, setFeed] = useState([]);
  const [hint, setHint] = useState(null);
  const [radio, setRadio] = useState(null);
  const [hitAt, setHitAt] = useState(0);
  const [save, setSave] = useState(null);
  const [attract, setAttractState] = useState(false);
  const [modes, setModes] = useState({});
  const [driver, setDriver] = useState("");
  const [askName, setAskName] = useState(null); // null | "play" | "rename"
  const [notice, setNotice] = useState(null);
  const [chats, setChats] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [arenaRes, setArenaRes] = useState(null);
  const [spawn, setSpawn] = useState(null); // "Choose your ride" options
  const [spawnErr, setSpawnErr] = useState(null);
  const [touchOn, setTouchOn] = useState(false); // touch controls showing (phones, tablets, ?touch=1)
  const [coarse, setCoarse] = useState(false);
  const [trader, setTrader] = useState(null); // { id, tab } of the open Trader menu
  const [rankUp, setRankUp] = useState(null);
  const [, force] = useState(0);

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
    const g = gameRef.current;
    if (!g) return;
    // Online every menu leaves the room running while the car sits idle (ui/menuPause.js); single player pauses.
    g.setPaused(menuFreezes(p, net.mode === "online") && !(p === "title" && g.game.attract));
    g.setUiOpen(p === "build" || isMenu(p));
    if (p !== "playing" && document.pointerLockElement) document.exitPointerLock();
  };
  const nav = useMenuNav({ gameRef, phase, setPhase }); // the menus under the title (docs/menus.md)
  const loading = useMapLoading(); // the loading screen in front of a world map

  useEffect(() => {
    let disposed = false, offTouch = null;
    setCoarse(isCoarsePointer());
    const m = readModes();
    setModes(m);
    setDriver(getDriverName());
    const restoreRandom = m.test ? seedRandom() : null;
    const s = loadSave();
    if (QUALITY[m.quality]) s.quality = m.quality; else if (!s.qualityChosen || !QUALITY[s.quality]) s.quality = detectQuality(); // ?quality=<preset> for a check, else auto until the player picks one
    setSave(s);
    const emit = (e) => {
      if (e.type === "callout") {
        const id = uid++;
        setBig((b) => [...b.slice(-3), { ...e, id }]);
        setTimeout(() => setBig((b) => b.filter((x) => x.id !== id)), 2200);
      } else if (e.type === "minor") {
        const id = uid++;
        setFeed((f) => [...f.slice(-6), { ...e, id }]);
        setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 2500);
      } else if (e.type === "hint") {
        setHint(e);
        setTimeout(() => setHint((h) => (h && h.id === e.id ? null : h)), e.time * 1000);
      } else if (e.type === "radio") {
        const id = uid++;
        setRadio({ ...e, id });
        setTimeout(() => setRadio((r) => (r && r.id === id ? null : r)), 6000);
      } else if (e.type === "chat") {
        const id = uid++;
        setChats((c) => [...c.slice(-5), { ...e, id }]);
        setTimeout(() => setChats((c) => c.filter((x) => x.id !== id)), 10000);
      } else if (e.type === "chatOpen" && phaseRef.current === "playing") { setChatOpen(true); gameRef.current.setUiOpen(true); }
      else if (e.type === "emoteOpen" && phaseRef.current === "playing") setEmoteOpen(true);
      else if (e.type === "hit") setHitAt(performance.now());
      else if (e.type === "demo") {
        if (e.on) { if (phaseRef.current !== "demo") demoFromRef.current = phaseRef.current; setAttractState(false); setPhase("demo"); }
        else if (phaseRef.current === "demo") setPhase(demoFromRef.current === "playing" ? "playing" : "title");
      } else if (e.type === "photo" || (e.type === "pause" && phaseRef.current === "photo")) { // O toggles photo mode, Esc leaves it
        if (phaseRef.current === "playing") setPhase("photo"); else if (phaseRef.current === "photo") setPhase("playing");
      } else if (e.type === "pause") {
        if (phaseRef.current === "demo") { gameRef.current.stopDemo(); setPhase(demoFromRef.current === "playing" ? "playing" : "title"); }
        else if (phaseRef.current === "playing") setPhase("paused");
        else if ((phaseRef.current === "trader" || phaseRef.current === "map") && !e.force) setPhase("playing");
        else if (phaseRef.current === "paused" && !e.force) setPhase("playing");
      } else if (e.type === "garage" && phaseRef.current === "playing") setPhase("garage");
      else if (e.type === "trader" && phaseRef.current === "playing") { setTrader({ id: e.id, tab: e.tab }); setPhase("trader"); }
      else if (e.type === "map") { if (phaseRef.current === "playing") setPhase("map"); else if (phaseRef.current === "map") setPhase("playing"); }
      else if (e.type === "buildView") {
        if (e.on && phaseRef.current === "playing") setPhase("build");
        else if (!e.on && phaseRef.current === "build") setPhase("playing");
      } else if (e.type === "results" && (phaseRef.current === "playing" || phaseRef.current === "build" || phaseRef.current === "paused")) {
        gameRef.current.game.buildView.close();
        setResults(e.data); setPhase("results");
      }
      else if (e.type === "arenaResults" && (phaseRef.current === "playing" || phaseRef.current === "paused")) { setArenaRes(e.data); setPhase("arenaResults"); }
      else if (e.type === "play") setPhase("playing");
      else if (e.type === "spawnMenu") {
        setSpawnErr(null);
        if (e.on) { setSpawn(gameRef.current.game.onfoot.spawn.options()); setPhase("spawn"); }
        else { setSpawn(null); if (phaseRef.current === "spawn") setPhase("playing"); }
      } else if (e.type === "rankUp") {
        const gm = gameRef.current?.game;
        setRankUp({ label: e.label, kind: e.top ? "overall" : "track", track: e.track, avatar: gm?.save?.profile?.avatar });
      }
    };
    createGame(canvasRef.current, { save: s, emit, modes: m, onState: setHud, onProgress: (p, msg) => setProgress({ p, msg }) }).then((g) => {
      if (disposed) { g.dispose(); return; }
      gameRef.current = g;
      setTouchOn(g.game.touch.enabled());
      offTouch = g.game.touch.onChange(setTouchOn);
      g.start();
      if (!storageOk()) { setNotice("Progress won't be saved on this device"); setTimeout(() => setNotice(null), 6000); } // private mode or blocked site data
      const bootMap = bootMapRules(); // ?map=city[&mode=roam|hunt|wreck]: straight into a world map (maps/bootMap.js)
      if (bootMap) setRules(bootMap);
      if (bootMap || m.autoplay || m.test || m.accel || m.selfcheck || m.mechcheck || m.bikecheck || m.tankcheck || m.bigcheck || m.famecheck || (m.racecheck && m.track)) { g.beginPlay(); setPhase("playing"); }
      else {
        setPhase("title");
        // Shared links: ?rules=<code> or ?preset=<name> open the Custom Game screen with those rules.
        const q = new URLSearchParams(window.location.search);
        const shared = decodeRules(q.get("rules")) || (q.get("preset") && findPreset(q.get("preset")));
        if (shared) { setRules(shared); nav.go("custom"); }
        const ll = linkedLobby(); // a lobby share link, or the lobby this tab was in before a reload
        if (ll) g.game.lobby.join(ll.id, ll.code, ll.shard);
      }
    });
    const onLock = () => {
      const locked = !!document.pointerLockElement;
      const replaying = gameRef.current && gameRef.current.game.replay.active; // Esc there skips the replay
      if (!locked && lockedRef.current && phaseRef.current === "playing" && !replaying) setPhase("paused");
      lockedRef.current = locked;
    };
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      disposed = true;
      if (offTouch) offTouch();
      document.removeEventListener("pointerlockchange", onLock);
      if (gameRef.current) gameRef.current.dispose();
      gameRef.current = null;
      if (restoreRandom) restoreRandom();
    };
  }, []);

  const startAttract = useCallback(() => {
    const g = gameRef.current;
    if (!g || phaseRef.current !== "title") return;
    g.setAttract(true);
    g.setPaused(false);
    setAttractState(true);
  }, []);
  useAttract(phase === "title" && !attract, startAttract, FLOW.attractIdle);
  useUiClicks(gameRef);

  const wakeAudio = (g) => { g.unlockAudio(); for (const k of ["master", "music", "sfx"]) g.game.audio.setVolume(k, save.volume[k]); };
  // Online: connect (6 s budget) with the driver name and garage car, else single player. rules: Custom Game / map picker.
  const play = async (online, name = driver, rules = null) => {
    const g = gameRef.current;
    if (online && !name) { setAskName("play"); return; }
    setRules(online || !rules ? DEFAULT_RULES : rules);
    wakeAudio(g);
    setAttractState(false);
    let welcome = null;
    if (online) {
      g.setAttract(false);
      setPhase("connecting");
      welcome = await net.goOnline(helloFor(g.game.save, name));
      if (!welcome) { setNotice("Couldn't reach the Saltreach server · driving solo"); setTimeout(() => setNotice(null), 4500); }
    }
    g.beginPlay(welcome);
    if (!welcome && (!rules || rules.mode !== "arena")) g.game.maps.resumeRoam(); // back where you left free roam
    setPhase(g.game.onfoot.spawn.isOpen() ? "spawn" : "playing");
  };
  const saveName = (n) => {
    const after = askName;
    setDriverName(n); setDriver(n); setAskName(null);
    if (after === "play") play(true, n);
    else if (after === "host") gameRef.current.game.lobby.openHostForm(hostRulesRef.current);
    else if (after === "find") gameRef.current.game.lobby.browse();
    else if (after === "quick") quickPlay(n);
  };
  const hostRulesRef = useRef(null); // lobbies (from Custom Game): a driver name first, then the host form or the list
  const lobbyHost = (r) => { hostRulesRef.current = r; if (!driver) setAskName("host"); else gameRef.current.game.lobby.openHostForm(r); };
  const lobbyFind = () => { if (!driver) setAskName("find"); else gameRef.current.game.lobby.browse(); };
  const lobbyPhase = useCallback((want) => {
    const g = gameRef.current;
    if (want === "lobby") wakeAudio(g);
    if (want !== "title") setAttractState(false);
    if (want !== "playing" || phaseRef.current !== "paused") setPhase(want);
  }, [save]); // eslint-disable-line react-hooks/exhaustive-deps
  const launch = ({ online = false, rules = null }) => { nav.markLaunch(); loading.run(rules && rules.mode === "arena" && rules.map, () => play(online, driver, rules)); };
  // Play now: an ONLINE match (game.quick joins or hosts a lobby, bots fill it). A local game only when "Play offline" is pressed.
  const quickPlay = (name = driver) => { if (!name) { setAskName("quick"); return; } nav.markLaunch(); lobbyPhase("lobby"); gameRef.current.game.quick.start(); };
  const quickOffline = () => { gameRef.current.game.quick.cancel(); launch({}); };
  const nextArenaMap = () => { const g = gameRef.current, r = getRules(), map = nextMap(r.map); setArenaRes(null); loading.run(map, () => { g.leaveArena(); setRules({ ...r, map }); g.rematch(); setPhase("playing"); }); };
  const pickerKind = () => (getRules().mode !== "arena" ? "roam" : getRules().win === "race" ? "race" : "arena");
  const closeChat = () => { setChatOpen(false); gameRef.current.setUiOpen(false); };
  const demo = () => {
    const g = gameRef.current;
    wakeAudio(g);
    g.startDemo();
    demoFromRef.current = "title";
    setAttractState(false);
    setPhase("demo");
  };
  const quality = (q) => { gameRef.current.setQuality(q); writeSave(save); force((x) => x + 1); };
  const volume = (k, v) => { save.volume[k] = v; gameRef.current.game.audio.setVolume(k, v); writeSave(save); };
  const closeGarage = () => { gameRef.current.applyGarage(); setPhase("playing"); };
  const flyHeli = () => {
    closeGarage();
    const r = gameRef.current.game.air.spawn("heli", { admin: false });
    if (!r.ok) gameRef.current.game.emit({ type: "minor", text: r.msg.toUpperCase() });
  };
  const live = gameRef.current?.game.save || save;
  const spawnZone = useCallback((id) => setSpawn(gameRef.current.game.onfoot.spawn.options(id)), []);
  const spawnRefresh = useCallback(() => setSpawn((o) => (o ? gameRef.current.game.onfoot.spawn.options(o.zoneId) : o)), []);
  const spawnChoose = (zoneId, id, repair) => {
    const r = gameRef.current.game.onfoot.spawn.choose(zoneId, id, { repair });
    if (!r.ok) { setSpawnErr(r.reason); spawnRefresh(); }
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" onClick={() => lockPointer(canvasRef.current, phaseRef.current === "playing")} />
      {(phase === "playing" || phase === "build") && !(hud && hud.replaying) && <Hud hud={hud} hitAt={hitAt} />}
      {phase === "build" && hud && <BuildBar build={hud.build} game={gameRef.current.game} touch={touchOn} onSelect={(k) => gameRef.current.game.buildView.select(k)} onStamp={() => gameRef.current.game.buildView.stamp()} onClose={() => gameRef.current.game.buildView.close()} />}
      {phase === "build" && <Callouts big={big} feed={feed} />}
      {phase === "build" && <RadioLine radio={radio} />}
      {phase === "results" && <Results data={results} onNext={() => { gameRef.current.nextCycle(); setResults(null); setPhase("playing"); }} onMenu={() => { gameRef.current.nextCycle(); setResults(null); nav.toMenu(); }} />}
      {phase === "playing" && !(hud && hud.replaying) && <Callouts big={big} feed={feed} />}
      {phase === "playing" && <HintCard hint={hint} />}
      {phase === "playing" && <RadioLine radio={radio} />}
      {phase === "playing" && <ReplayUi hud={hud} onReplay={() => gameRef.current.replay()} />}
      {phase === "demo" && <DemoBadge hud={hud} />}
      {touchOn && phase === "playing" && hud && !hud.replaying && !hud.autopilot && <TouchControls tc={gameRef.current.game.touch} mode={hud.touch || "drive"} safe={hud.safe} />}
      {touchOn && <RotateCard />}
      {(modes.debug || modes.selfcheck) && phase !== "loading" && <DebugOverlay d={hud && hud.debug} />}
      {phase === "loading" && <BootSplash progress={progress.p} tip={progress.msg} />}
      <CheckCards modes={modes} hud={hud} />
      {phase === "playing" && <ChatBox lines={chats} open={chatOpen} onSend={(t) => gameRef.current.sendChat(t)} onClose={closeChat} />}
      {phase === "playing" && emoteOpen && <EmoteWheel onPick={(i) => { gameRef.current.sendEmote(i); setEmoteOpen(false); }} onClose={() => setEmoteOpen(false)} />}
      {phase === "connecting" && <ConnectingCard />}
      {notice && <div className="pointer-events-none fixed left-1/2 top-16 -translate-x-1/2 sw-panel px-4 py-2 sw-body text-sm text-[#ffcf7a] sw-slide">{notice}</div>}
      {phase === "title" && live && gameRef.current && <MenuFlow nav={nav} save={live} handle={gameRef.current} attract={attract} driver={driver} onLaunch={launch} onQuick={() => quickPlay()} onDemo={demo} onFind={lobbyFind} onHost={lobbyHost} onQuality={quality} onVolume={volume} onRename={() => setAskName("rename")} onSave={() => { setSave({ ...live }); force((x) => x + 1); }} />}
      <RankUpPopup data={rankUp} onDone={() => setRankUp(null)} />
      {gameRef.current && live && <LobbyScreens game={gameRef.current.game} save={live} driver={driver} phase={phase} onPhase={lobbyPhase} quick={{ retry: () => quickPlay(), offline: quickOffline }} />}
      {phase === "arenaResults" && <ArenaResults data={arenaRes} onRematch={() => { gameRef.current.rematch(); setArenaRes(null); setPhase("playing"); }} onNext={nextArenaMap} onLeave={() => { setArenaRes(null); nav.toMenu(); }} />}
      {askName && <NameCard initial={driver} onSave={saveName} onCancel={() => setAskName(null)} />}
      {phase === "paused" && live && <PauseMenu save={live} game={gameRef.current?.game} aimMode={gameRef.current?.game.playerAim.mode()} onAimMode={(m) => { gameRef.current.setAimMode(m); force((x) => x + 1); }} onResume={() => setPhase("playing")} onQuality={quality} onVolume={volume} arena={!!gameRef.current?.game.arena.active} onRestart={() => { gameRef.current.rematch(); setPhase("playing"); }} onChangeMap={() => nav.toMenu("maps", pickerKind())} onLeave={() => nav.toMenu()} touch={touchOn} showTouch={touchOn || coarse} online={net.mode === "online"} reputation={gameRef.current?.game.factions.all()} />}
      <FactionScreens phase={phase} game={gameRef.current?.game} trader={trader} online={net.mode === "online"} onClose={() => setPhase("playing")} />
      {phase === "garage" && live && <Garage save={live} game={gameRef.current?.game} onClose={closeGarage} onFly={flyHeli} />}
      {phase === "spawn" && <SpawnMenu opts={spawn} error={spawnErr} onZone={spawnZone} onChoose={spawnChoose} onRefresh={spawnRefresh} onClose={() => gameRef.current.game.onfoot.spawn.close()} />}
      <AdminLayer game={gameRef.current?.game} playing={phase === "playing"} onRules={(r) => play(false, driver, r)} />
      <ExtrasLayer game={gameRef.current?.game} phase={phase} hud={hud} touch={touchOn} />
      <MapLoading map={loading.map} />
    </div>
  );
}