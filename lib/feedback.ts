import crypto from "crypto";
import { incrBy, lpushCapped, lrange, lrem } from "./store";

// Comic feedback on a swap. No personal data: an anonymous per-tab session id, no IP stored.
export const RATINGS = ["use", "close", "wrong"] as const;
export type Rating = (typeof RATINGS)[number];
export type Feedback = {
  id: string; ts: string; city: string; joke: string; original: string; swapped: string; category: string; list: string;
  popularity: number | null; lift: number | null; rising: boolean; nearPunch: boolean | null; rank: number; others: string[];
  rating: Rating; note: string; session: string;
  /** TN-FIX4: the local truth shown next to the swap (not Qloo), or "" if none. */
  angle: string; angleCategory: string;
};
export const FB_KEY = "fb:all";
const CAP = 5000;
const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Validate untrusted input into a record, or return an error string. */
export function parseFeedback(b: Record<string, unknown>, now = new Date()): Feedback | string {
  if (!RATINGS.includes(b.rating as Rating)) return "Pick one of the three ratings.";
  const city = s(b.city, 60), swapped = s(b.swapped, 120), joke = s(b.joke, 500);
  if (!city || !swapped || !joke) return "Missing the swap.";
  const session = s(b.session, 64);
  if (!/^[a-z0-9-]{8,64}$/i.test(session)) return "Bad session.";
  const rank = n(b.rank);
  return {
    id: crypto.randomUUID(), ts: now.toISOString(), city, joke, original: s(b.original, 120), swapped,
    category: s(b.category, 40), list: s(b.list, 40), popularity: n(b.popularity), lift: n(b.lift), rising: b.rising === true,
    nearPunch: typeof b.nearPunch === "boolean" ? b.nearPunch : null, rank: rank !== null ? Math.max(1, Math.min(50, Math.round(rank))) : 0,
    others: Array.isArray(b.others) ? b.others.slice(0, 10).map((x) => s(x, 120)).filter(Boolean) : [],
    rating: b.rating as Rating, note: s(b.note, 280), session,
    angle: s(b.angle, 200), angleCategory: s(b.angleCategory, 40),
  };
}

export async function allowFeedback(ip: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const h = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
  return (await incrBy(`rl:${day}:fb:${h}`, 1, 60 * 60 * 26)) <= Number(process.env.TOWNIE_FEEDBACK_PER_IP ?? 40);
}
export const saveFeedback = (f: Feedback) => lpushCapped(FB_KEY, JSON.stringify(f), CAP);
export const listFeedback = async () => (await lrange(FB_KEY, CAP)).map((x) => JSON.parse(x) as Feedback);
export async function deleteFeedback(id: string): Promise<number> {
  const raw = (await lrange(FB_KEY, CAP)).find((x) => (JSON.parse(x) as Feedback).id === id);
  return raw ? lrem(FB_KEY, raw) : 0;
}

type Tally = { n: number; use: number; close: number; wrong: number; hitRate: number };
const bucketPop = (p: number | null) => (p === null ? "unknown" : p >= 0.9 ? "0.9+" : p >= 0.7 ? "0.7-0.9" : "<0.7");
const bucketLift = (l: number | null) => (l === null ? "unknown" : l >= 30 ? "30+" : l >= 10 ? "10-29" : "<10");
function group(rows: Feedback[], key: (f: Feedback) => string): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const f of rows) {
    const t = (out[key(f)] ??= { n: 0, use: 0, close: 0, wrong: 0, hitRate: 0 });
    t.n++; t[f.rating]++; t.hitRate = Math.round((t.use / t.n) * 100) / 100;
  }
  return out;
}
export function summarize(rows: Feedback[]) {
  return {
    total: rows.length,
    byRating: { use: rows.filter((f) => f.rating === "use").length, close: rows.filter((f) => f.rating === "close").length, wrong: rows.filter((f) => f.rating === "wrong").length },
    byCategory: group(rows, (f) => f.category || "unknown"),
    byPopularity: group(rows, (f) => bucketPop(f.popularity)),
    byLift: group(rows, (f) => bucketLift(f.lift)),
    byCity: group(rows, (f) => f.city),
    byRising: group(rows, (f) => (f.rising ? "rising" : "steady")),
    byAngle: group(rows, (f) => (f.angle ? "shown" : "none")),
    byAngleCategory: group(rows.filter((f) => f.angle), (f) => f.angleCategory || "unknown"),
    latestNotes: rows.filter((f) => f.note).slice(0, 20).map((f) => ({ ts: f.ts, city: f.city, swapped: f.swapped, rating: f.rating, note: f.note })),
  };
}

/** Constant-time admin check against FEEDBACK_ADMIN_TOKEN. */
export function isAdmin(req: Request): boolean {
  const want = process.env.FEEDBACK_ADMIN_TOKEN;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!want || want.length < 24 || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
