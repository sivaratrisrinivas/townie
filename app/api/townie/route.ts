import { resolveCity, CITIES } from "@/lib/cities";
import { runAgent, rerankSlot, type Result } from "@/lib/agent";
import { BudgetClosed, callClaude } from "@/lib/llm";
import { takeVisitor } from "@/lib/limits";
import { packsReady } from "@/lib/packs";
import { get, set } from "@/lib/store";
import { NICHE } from "@/lib/niche";
import { hash, ipOf, json, MAX_JOKE, TTL } from "@/lib/api";
import { POPULARITY_FLOOR } from "@/lib/rank";
import { pickAngle } from "@/lib/localAngle";

// TN-FIX4: attach one local angle (not Qloo) to any result for a covered city. Qloo still decides the swap.
function withAngle(r: Record<string, unknown>, joke: string, city: string) {
  const slots = r.slots as { category: string }[] | undefined;
  const cat = slots?.[typeof r.slotIndex === "number" ? r.slotIndex : 0]?.category;
  return { ...r, localAngle: pickAngle(city, joke, cat) };
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { joke?: string; city?: string; slotIndex?: number; loosen?: boolean };
  const joke = (b.joke ?? "").replace(/\r\n/g, "\n");
  if (!joke.trim() || joke.length > MAX_JOKE) return json({ status: "validation", message: `Paste a joke up to ${MAX_JOKE} characters.` }, 400);
  const city = resolveCity(b.city ?? "");
  if (!city) return json({ status: "city_not_covered", message: `Not covered yet. Covered cities: ${CITIES.map((c) => c.name).join(", ")}.` });
  if (!packsReady()) return json({ status: "qloo_error", message: "Couldn't reach Qloo. Your joke is safe." }, 503);

  const key = `${NICHE ? "n3" : "r4"}:${hash(joke, city.name)}`;
  const floor = b.loosen ? POPULARITY_FLOOR - 0.2 : undefined;
  const cachedRaw = await get(key);
  const cached = cachedRaw ? (JSON.parse(cachedRaw) as Result) : null;

  if (cached && "slots" in cached && (typeof b.slotIndex === "number" || b.loosen)) {
    const idx = typeof b.slotIndex === "number" ? b.slotIndex : cached.slotIndex;
    if (idx < 0 || idx >= cached.slots.length) return json({ status: "validation", message: "Unknown slot." }, 400);
    return json(withAngle({ ...rerankSlot(joke, city, cached.slots, idx, floor), cached: true, correctedCity: city.name }, joke, city.name));
  }
  if (cached) return json(withAngle({ ...cached, cached: true, correctedCity: city.name }, joke, city.name));

  if (!(await takeVisitor(ipOf(req), "run"))) return json({ status: "rate_limited", message: "You've used today's free runs. Examples and cached jokes still work." }, 429);
  let result: Result | null = null;
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      result = await runAgent(joke, city, callClaude, floor);
    } catch (e) {
      if (e instanceof BudgetClosed) return json({ status: "budget", message: "Townie is resting for today. Examples still work." }, 503);
      if (attempt === 1) return json({ status: "llm_error", message: "The noun finder tripped." }, 502);
    }
  }
  await set(key, JSON.stringify(result), TTL);
  return json(withAngle({ ...result, cached: false, correctedCity: city.name }, joke, city.name));
}
