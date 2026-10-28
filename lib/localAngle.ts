// TN-FIX4: one "local angle" for the reveal screen. NOT from Qloo: hand-gathered local truths
// (Reddit, YouTube captions, local press), bundled at build time. Qloo still decides the name swap.
import data from "./localTruths.json";

export type Truth = { city: string; reference: string; why: string; category: string; spread: string; verified: string; url: string };
export type Angle = { reference: string; why: string; category: string; url: string; source: string };
export const ANGLE_LABEL = "From local sources, not Qloo";
const TRUTHS = (data as { items: Truth[] }).items;

// Joke topic -> truth category. Plain word lists; no LLM call.
const TOPICS: [string, RegExp][] = [
  ["food_ritual", /\b(eat\w*|ate|food|rib|ribs|bbq|barbecue|biryani|pizza|slice|burger|taco\w*|lunch|dinner|breakfast|brunch|snack\w*|chai|coffee|tea|restaurant|menu\w*|order(ed)?|hungry|diet|salad|guacamole|fries|dosa|vada|pav|kitchen|oven|cook\w*|meal|delivery)\b/i],
  ["commute", /\b(train|local|traffic|commut\w*|bus|metro|subway|drive|driving|car|uber|ola|auto|rickshaw|highway|freeway|parking|signal|flyover|jam|stuck|toll|airport|lane)\b/i],
  ["weather", /\b(rain\w*|heat|hot|humid\w*|cold|snow\w*|monsoon|summer|winter|sweat\w*|weather|degrees|sun)\b/i],
  ["area_tease", /\b(apartment|flat|rent|landlord|suburb\w*|neighbou?rhood|area|moved|move|lives? in|borough|downtown)\b/i],
  ["rivalry", /\b(better than|rival\w*|vs\.?|versus)\b/i],
];
const SPREAD: Record<string, number> = { high: 3, medium: 2, low: 1 };
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);

/** Which truth category the joke is about, or null. A dining swap leans food. */
export function jokeTopic(joke: string, slotCategory?: string): string | null {
  let best: string | null = null, bestN = 0;
  for (const [cat, re] of TOPICS) {
    let k = (joke.match(new RegExp(re.source, "gi")) ?? []).length;
    if (cat === "food_ritual" && (slotCategory === "dining" || slotCategory === "restaurant")) k += 1;
    if (k > bestN) { best = cat; bestN = k; }
  }
  return best;
}

/** The single best local truth for this city and joke: category, then spread, then verified=full_text, then shared words. */
export function pickAngle(city: string, joke: string, slotCategory?: string, truths: Truth[] = TRUTHS): Angle | null {
  const topic = jokeTopic(joke, slotCategory);
  if (!topic) return null;
  const jw = words(joke);
  const pool = truths.filter((t) => t.city === city && t.category === topic);
  if (!pool.length) return null;
  const score = (t: Truth) => [SPREAD[t.spread] ?? 0, t.verified === "full_text" ? 1 : 0, [...words(t.reference + " " + t.why)].filter((w) => jw.has(w)).length];
  const best = pool.map((t, i) => ({ t, s: score(t), i })).sort((a, b) => b.s[0] - a.s[0] || b.s[1] - a.s[1] || b.s[2] - a.s[2] || a.i - b.i)[0].t;
  let source = "source";
  try { source = new URL(best.url).hostname.replace(/^www\./, ""); } catch {}
  return { reference: best.reference, why: best.why, category: best.category, url: best.url, source };
}
