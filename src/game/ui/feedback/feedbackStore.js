// When the feedback card may show: not for a week after you sent one, not for a day after "Not now".
import { local } from "@/game/core/safeStorage";
const KEY = "scrapwake-feedback-v1";
const DAY = 86400000;

function read() {
  try { return JSON.parse(local.get(KEY) || "{}") || {}; } catch { return {}; }
}
function write(d) {
  try { local.set(KEY, JSON.stringify(d)); } catch { /* private mode: asks again next visit */ }
}

export function canAsk(now = Date.now()) {
  const d = read();
  return !(d.sentAt && now - d.sentAt < 7 * DAY) && !(d.laterAt && now - d.laterAt < DAY);
}
export const markSent = () => write({ ...read(), sentAt: Date.now() });
export const markLater = () => write({ ...read(), laterAt: Date.now() });