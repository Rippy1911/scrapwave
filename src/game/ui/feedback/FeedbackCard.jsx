import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { sendFeedback } from "@/lib/server-fns";
import { VERSION } from "@/game/data/tuning";
import { getRules } from "@/game/rules/state";
import { markSent, markLater } from "@/game/ui/feedback/feedbackStore";

const LIKED = [["driving", "Driving"], ["combat", "Combat"], ["building", "Building"], ["flying", "Flying"], ["mechs", "Mechs"], ["racing", "Racing"], ["other", "Other"]];
const TITLE = { arena: "How was that match?", cycle: "How was that cycle?", safe_zone: "How is Scrapwave so far?" };
const quiet = (e) => e.stopPropagation(); // typing here must not drive the car

// Feedback card: a 1 to 5 rating (needed), what you liked most and a note (both optional). Sent to the Feedback records.
export default function FeedbackCard({ context, touch, onDone }) {
  const send = useServerFn(sendFeedback);
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true); setError("");
    try {
      await send({ data: { rating, liked: liked || undefined, comment: comment.trim() || undefined, context, mode: getRules().name, version: String(VERSION), device: touch ? "touch" : "desktop", play_minutes: Math.round(performance.now() / 60000) } });
      markSent(); setSent(true); setTimeout(onDone, 1800);
    } catch {
      setError("That did not send. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  const later = () => { markLater(); onDone(); };
  return (
    <div className="fixed bottom-3 right-3 z-[60] w-[min(22rem,calc(100vw-1.5rem))] sw-panel px-4 py-3 sw-body text-[#e9dcc4] sw-slide">
      {sent ? <div className="py-4 text-center sw-display text-xl text-[#7fe0a0]">THANKS, DRIVER</div> : (
        <div className="flex flex-col gap-2.5">
          <div className="sw-display text-lg text-[#f2c230]">{TITLE[context] || TITLE.safe_zone}</div>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} of 5`} onClick={() => setRating(n)} className="flex h-10 w-10 items-center justify-center">
                <Star className={`h-7 w-7 ${n <= rating ? "fill-[#f2c230] text-[#f2c230]" : "text-[#57503f]"}`} />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {LIKED.map(([id, name]) => (
              <button key={id} type="button" onClick={() => setLiked(liked === id ? "" : id)} className={`min-h-[32px] rounded-sm border px-2 text-[11px] uppercase tracking-wider ${liked === id ? "border-[#f2c230] bg-[#3a3122] text-[#f2c230]" : "border-[#46413a] text-[#d8cbb2]"}`}>{name}</button>
            ))}
          </div>
          <textarea value={comment} maxLength={600} rows={2} placeholder="Anything to fix or add? (optional)" onChange={(e) => setComment(e.target.value)} onKeyDown={quiet} onKeyUp={quiet} className="resize-none border border-[#57503f] bg-[#141210] px-2 py-1.5 text-sm text-[#f4ead6] placeholder:text-[#7d7262]" />
          {error && <div className="text-xs text-[#ff8a6a]">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={later} className="sw-btn px-3 py-1.5 text-[11px]">Not now</button>
            <button type="button" onClick={submit} disabled={!rating || busy} className="sw-btn sw-btn-primary px-4 py-1.5 text-[11px] disabled:opacity-50">{busy ? "Sending..." : "Send"}</button>
          </div>
        </div>
      )}
    </div>
  );
}