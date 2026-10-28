import { resolveCity } from "@/lib/cities";
import { plainSwap, type FoundSlot, type Result } from "@/lib/agent";
import { BudgetClosed, callClaude } from "@/lib/llm";
import { takeVisitor } from "@/lib/limits";
import { get, set } from "@/lib/store";
import { hash, ipOf, json, TTL } from "@/lib/api";

export const runtime = "nodejs";

/** Without Qloo (D9): one live Haiku call, cached per joke, city and slot (AC8). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { joke?: string; city?: string; slotIndex?: number; slot?: { text?: unknown; role?: unknown; start?: unknown; end?: unknown } };
  const joke = (b.joke ?? "").replace(/\r\n/g, "\n");
  const city = resolveCity(b.city ?? "");
  if (!city) return json({ status: "error", message: "Couldn't load the plain version." }, 400);
  const raw = await get(`r2:${hash(joke, city.name)}`);
  const r = raw ? (JSON.parse(raw) as Result) : null;
  // The store is per instance without Upstash, so the cached run may live on another instance.
  // Fall back to the slot the client was shown, after checking it really is in the joke.
  const idx = typeof b.slotIndex === "number" ? b.slotIndex : r && "slots" in r ? r.slotIndex : 0;
  const slot = r && "slots" in r ? r.slots[idx] : clientSlot(joke, b.slot);
  if (!r && !slot) return json({ status: "error", message: "Run Townie on this joke first." }, 400);
  if (!slot) return json({ status: "error", message: "Unknown slot." }, 400);

  const key = `p2:${hash(joke, city.name, String(idx))}`;
  const hit = await get(key);
  if (hit) return json({ ...JSON.parse(hit), cached: true });
  if (!(await takeVisitor(ipOf(req), "plain"))) return json({ status: "rate_limited", message: "You've used today's free runs. Examples and cached jokes still work." }, 429);
  try {
    const out = { status: "ok", ...(await plainSwap(joke, city, slot, callClaude)) };
    await set(key, JSON.stringify(out), TTL);
    return json({ ...out, cached: false });
  } catch (e) {
    if (e instanceof BudgetClosed) return json({ status: "budget", message: "Townie is resting for today. Examples still work." }, 503);
    return json({ status: "error", message: "Couldn't load the plain version." }, 502);
  }
}

function clientSlot(joke: string, s: { text?: unknown; role?: unknown; start?: unknown; end?: unknown } | undefined): FoundSlot | null {
  if (!s || typeof s.text !== "string" || typeof s.role !== "string" || typeof s.start !== "number" || typeof s.end !== "number") return null;
  if (s.role.length > 80 || s.start < 0 || s.end > joke.length || joke.slice(s.start, s.end) !== s.text) return null;
  return { text: s.text, role: s.role, start: s.start, end: s.end } as FoundSlot;
}
