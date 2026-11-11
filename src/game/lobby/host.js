// The host's side of a lobby: applies what guests send (join, leave, ready, ride, results), validates rides
// against the rules, and broadcasts the snapshot (coalesced) and the list beacon.
import * as LS from "@/game/lobby/lobbyState";
import { checkRide } from "@/game/lobby/rideRules";
import { packSnapshot, packBeacon } from "@/game/lobby/packing";
import { addReport, board, boardClosed, clearReports } from "@/game/lobby/results";

const BEACON_S = 5, KEEPALIVE_S = 15;
const rideIn = (d) => (d && typeof d === "object" && d.ch ? { kind: d.k === "g" ? "garage" : "free", ch: String(d.ch), tier: d.t | 0 || 1 } : null);
export const rideOut = (r) => (r ? { k: r.kind === "garage" ? "g" : "f", ch: r.ch, t: r.tier } : null);

export function createHostSide({ T, get, changed, myName }) {
  let snapTimer = 0, beaconT = 0, keepT = 0;
  const L = () => get().lobby;
  const no = (to, why) => T.send("no", L().id, { to, why });

  const H = {
    // Coalesce changes into one snapshot a moment later (rule sliders send many changes).
    snapshot(now = false) {
      clearTimeout(snapTimer);
      const go = () => { const l = L(); if (l && get().role === "host") { T.send("s", l.id, packSnapshot(l), "snap"); keepT = 0; } changed(); };
      if (now) go(); else snapTimer = setTimeout(go, 350);
    },
    beacon() {
      const l = L();
      if (l) T.send("b", l.id, packBeacon(l, { hostName: myName(), rtt: T.rtt(), shard: T.shard() }), "beacon");
      beaconT = 0;
    },
    onGuest(m) {
      const l = L(), from = m.from, d = m.data || {};
      if (!l || m.lid !== l.id) return;
      let r = { ok: true };
      switch (m.type) {
        case "j": {
          const ride = rideIn(d.rd);
          r = LS.join(l, { id: from, name: d.n || m.name, ride: ride && !checkRide(l.rules, ride) ? ride : null }, d.c);
          if (!r.ok) return no(from, r.reason);
          break;
        }
        case "q": r = LS.leave(l, from); break;
        case "r": r = LS.setReady(l, from, !!d.on); break;
        case "d": {
          const ride = rideIn(d), bad = checkRide(l.rules, ride);
          if (bad) return no(from, bad);
          r = LS.setRide(l, from, ride);
          break;
        }
        case "f": {
          if (l.phase !== "match") return undefined;
          l.results = addReport(l, from, d);
          if (boardClosed(l)) LS.finishMatch(l, board(l));
          break;
        }
        case "rq": return H.snapshot(true);
        default: return undefined;
      }
      if (!r.ok) return no(from, r.reason);
      H.snapshot();
      return undefined;
    },
    // Host's own result.
    report(rep) {
      const l = L();
      if (!l || l.phase !== "match") return;
      l.results = addReport(l, l.hostId, rep);
      if (boardClosed(l)) LS.finishMatch(l, board(l));
      H.snapshot();
    },
    // After a rules change: rides the new rules forbid go back to the default ride.
    recheckRides() {
      const l = L();
      for (const p of l.players) if (p.ride && checkRide(l.rules, p.ride)) p.ride = null;
    },
    start() {
      const l = L();
      clearReports(l);
      const r = LS.startMatch(l, l.hostId);
      if (r.ok) { l.ending = false; H.snapshot(true); }
      return r;
    },
    tick(dt) {
      const l = L();
      if (!l || get().role !== "host") return;
      if (LS.prune(l)) H.snapshot();
      if (l.phase === "match" && l.firstReportAt && boardClosed(l)) { LS.finishMatch(l, board(l)); H.snapshot(); }
      beaconT += dt; keepT += dt;
      if (beaconT >= BEACON_S && l.phase !== "closed") H.beacon();
      if (keepT >= KEEPALIVE_S) H.snapshot(true);
    },
    dispose() { clearTimeout(snapTimer); },
  };
  return H;
}