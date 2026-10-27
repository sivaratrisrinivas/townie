import { resolveCity } from "@/lib/cities";
import { plainSwap, type Result } from "@/lib/agent";
import { BudgetClosed, callClaude } from "@/lib/llm";
import { takeVisitor } from "@/lib/limits";
import { get, set } from "@/lib/store";
import { hash, ipOf, json, TTL } from "@/lib/api";

export const runtime = "nodejs";

/** Without Qloo (D9): one live Haiku call, cached per joke, city and slot (AC8). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { joke?: string; city?: string; slotIndex?: number };
  const joke = (b.joke ?? "").replace(/\r\n/g, "\n");
  const city = resolveCity(b.city ?? "");
  if (!city) return json({ status: "error", message: "Couldn't load the plain version." }, 400);
  const raw = await get(`r:${hash(joke, city.name)}`);
  const r = raw ? (JSON.parse(raw) as Result) : null;
  if (!r || !("slots" in r)) return json({ status: "error", message: "Run Townie on this joke first." }, 400);
  const idx = typeof b.slotIndex === "number" ? b.slotIndex : r.slotIndex;
  const slot = r.slots[idx];
  if (!slot) return json({ status: "error", message: "Unknown slot." }, 400);

  const key = `p:${hash(joke, city.name, String(idx))}`;
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
