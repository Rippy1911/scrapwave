// Daily contracts: three per real day from CONTRACTS, tracked against lifetime stats, one free reroll per day.
// Pure functions over the save so the garage can show them without the game.
import { CONTRACTS } from "@/game/data/tuning";
import { writeSave } from "@/game/core/save";

const STAT = { wheels: "wheels", jumps: "jumps", wrecks: "wrecks", bank: "banked", parts: "parts", flips: "flips", barrels: "barrels", convoy: "tankers" };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const statOf = (save, id) => save.stats[STAT[id]] || 0;

function pick(day) {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ids = CONTRACTS.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, 3);
}

export function ensureContracts(save) {
  const day = today();
  if (!save.contracts || save.contracts.day !== day) {
    const ids = pick(day);
    save.contracts = { day, ids, base: Object.fromEntries(ids.map((id) => [id, statOf(save, id)])), done: [], rerolled: false };
  }
  return save.contracts;
}

export function contractList(save) {
  const c = ensureContracts(save);
  return c.ids.map((id) => {
    const def = CONTRACTS.find((x) => x.id === id);
    const progress = Math.min(def.goal, statOf(save, id) - (c.base[id] || 0));
    return { id, text: def.text, goal: def.goal, reward: def.reward, progress: Math.max(0, progress), done: c.done.includes(id) };
  });
}

export function rerollContract(save, index) {
  const c = ensureContracts(save);
  if (c.rerolled || c.done.includes(c.ids[index])) return false;
  const pool = CONTRACTS.map((x) => x.id).filter((id) => !c.ids.includes(id));
  const id = pool[Math.floor(Math.random() * pool.length)];
  c.ids[index] = id; c.base[id] = statOf(save, id); c.rerolled = true;
  writeSave(save);
  return true;
}

// Called every couple of seconds in play: pays out finished contracts into banked scrap.
export function checkContracts(game) {
  const save = game.save, c = ensureContracts(save);
  for (const it of contractList(save)) {
    if (it.done || it.progress < it.goal) continue;
    c.done.push(it.id);
    save.banked += it.reward;
    game.callout("CONTRACT DONE", `${it.text} · +${it.reward} banked`, "#7fe0a0");
    game.audio.bank();
    if (!game.noSave) writeSave(save);
  }
}