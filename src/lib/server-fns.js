import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { validateFameUpdate, fameTotals, FAME_HOUR_CAP } from "@/game/fame/validate";
import { normalizeTag } from "@/game/fame/tagFilter";

export const getServerInfo = createServerFn({ method: "GET" }).handler(async () => ({
  renderedAt: new Date().toISOString(),
}));

// Player feedback from the game's feedback card. Deliberately public (the game has no login), so every field is
// bounded here and the Feedback records can only be read back by an admin.
const FeedbackInput = z.object({
  rating: z.number().int().min(1).max(5),
  liked: z.enum(["driving", "combat", "building", "flying", "mechs", "racing", "other"]).optional(),
  comment: z.string().max(600).optional(),
  context: z.enum(["arena", "cycle", "safe_zone"]),
  mode: z.string().max(40).optional(),
  version: z.string().max(16).optional(),
  device: z.enum(["desktop", "touch"]).optional(),
  play_minutes: z.number().min(0).max(100000).optional(),
});

export const sendFeedback = createServerFn({ method: "POST" })
  .validator(FeedbackInput)
  .handler(async ({ data, context }) => {
    await context.getBase44().entities.Feedback.create(data);
    return { ok: true };
  });

// Crash reports and play events, batched by src/game/core/telemetry.js: one call a minute at most, plus one when the
// page closes. Public like sendFeedback, so every field is bounded here and only an admin reads the records back.
const time = z.string().max(32).optional();
const ClientErrorInput = z.object({
  message: z.string().min(1).max(300),
  stack: z.string().max(1200).optional(),
  count: z.number().int().min(1).max(10000).optional(),
  version: z.string().max(16).optional(),
  browser: z.string().max(40).optional(),
  quality: z.string().max(16).optional(),
  mode: z.string().max(40).optional(),
  time,
});
const PlayEventInput = z.object({
  kind: z.enum(["session_start", "mode_pick", "match_end", "first_drive", "session_end"]),
  version: z.string().max(16).optional(),
  device: z.enum(["desktop", "touch"]).optional(),
  quality: z.string().max(16).optional(),
  mode: z.string().max(40).optional(),
  map: z.string().max(40).optional(),
  result: z.enum(["won", "lost", "cycle_end"]).optional(),
  match_seconds: z.number().min(0).max(100000).optional(),
  first_drive_ms: z.number().min(0).max(86400000).optional(),
  session_seconds: z.number().min(0).max(1000000).optional(),
  time,
});

export const sendTelemetry = createServerFn({ method: "POST" })
  .validator(z.object({ errors: z.array(ClientErrorInput).max(5), events: z.array(PlayEventInput).max(30) }))
  .handler(async ({ data, context }) => {
    const db = context.getBase44().entities;
    if (data.errors.length) await db.ClientError.bulkCreate(data.errors);
    if (data.events.length) await db.PlayEvent.bulkCreate(data.events);
    return { ok: true };
  });

const fameTrack = z.number().min(0).max(500000);
const FameInput = z.object({
  carnage: fameTrack,
  speed: fameTrack,
  stunts: fameTrack,
  survival: fameTrack,
  salvage: fameTrack,
  sky: fameTrack,
}).passthrough();

const AvatarInput = z.object({
  shape: z.string().max(16),
  icon: z.number().int().min(0).max(23),
  color: z.string().max(16),
  color2: z.string().max(16),
  border: z.string().max(16),
  walker: z.any().optional().nullable(),
}).passthrough();

const ProfileInput = z.object({
  fame: FameInput,
  equipped_title: z.string().max(32),
  tag: z.string().max(14).optional(),
  avatar: AvatarInput,
  fame_hour: z.object({ t: z.number(), gained: z.number().min(0).max(FAME_HOUR_CAP * 2) }).optional(),
});

export const loadProfile = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const rows = await context.getBase44().entities.PlayerProfile.filter({}, "-updated_date", 1);
    const row = rows[0];
    if (!row) return null;
    return {
      fame: fameTotals(row.fame),
      equipped_title: row.equipped_title || "overall:1",
      tag: row.tag || "",
      avatar: row.avatar || {},
      fame_hour: row.fame_hour || null,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(ProfileInput)
  .handler(async ({ data, context }) => {
    const db = context.getBase44().entities.PlayerProfile;
    const rows = await db.filter({}, "-updated_date", 1);
    const prev = rows[0] || null;
    const nextFame = fameTotals(data.fame);
    const prevFame = fameTotals(prev?.fame || {});
    const now = Date.now();
    let hour = data.fame_hour && now - data.fame_hour.t < 3600000 ? { ...data.fame_hour } : { t: now, gained: 0 };
    const check = validateFameUpdate(prevFame, nextFame, hour);
    if (!check.ok) return { ok: false, reason: check.reason };
    const gained = Object.keys(nextFame).reduce((s, k) => s + nextFame[k] - (prevFame[k] || 0), 0);
    hour = { t: hour.t, gained: Math.min(FAME_HOUR_CAP, Math.round(hour.gained + gained)) };
    const row = {
      fame: nextFame,
      equipped_title: String(data.equipped_title).slice(0, 32),
      tag: normalizeTag(data.tag),
      avatar: data.avatar,
      fame_hour: hour,
    };
    if (prev?.id) await db.update(prev.id, row);
    else await db.create(row);
    return { ok: true, hour };
  });
