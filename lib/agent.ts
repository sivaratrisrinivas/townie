import type { Category, CityDef } from "./cities";
import { CATEGORY_LABEL, shippedNote } from "./cities";
import type { LlmFn, Msg, ToolDef } from "./llm";
import { getCountryPacks, getNational, getPack, verifyLocality } from "./packs";
import type { Slot, Warning } from "./rank";
import { finalize, listFor, shortlist } from "./rank";
import { locate, stitch, swapAll } from "./stitch";
import { codeFlag } from "./flags";
import type { Flag, Pick } from "./types";

export interface FoundSlot extends Slot { occurrence: number; nearPunch: boolean; start: number; end: number }

export type Result =
  | { status: "ok"; joke: string; city: string; slots: FoundSlot[]; slotIndex: number; picks: Pick[]; selectedId: string | null; output: string; punchHint: boolean; roleLoose: boolean; onlyShared: boolean; fewer: boolean; locality: string | null; meanToLocals: boolean }
  | { status: "no_slot" }
  | { status: "category_not_covered"; message: string; slots: FoundSlot[]; slotIndex: number }
  | { status: "qloo_empty"; message: string; slots: FoundSlot[]; slotIndex: number }
  | { status: "locality_mismatch"; message: string };

const ROLE_VOCAB: Record<Category, string[]> = {
  dining: ["fast_food", "hamburger", "pizza", "coffee", "bakery", "ice_cream", "desserts", "steakhouse", "fast_casual", "restaurant_chains", "indian_cuisine", "beverages", "snacks"],
  retail: ["grocery", "supermarket", "apparel", "footwear", "beauty", "jewelry", "home_decor", "furniture", "fashion", "e_commerce", "online_retailers", "eyewear", "cosmetics", "sneakers", "department"],
  tv: ["comedy", "drama", "reality", "talk_show", "sitcom", "crime", "thriller", "romance", "competition", "documentary", "variety", "sports"],
  restaurant: [],
};

export const SYSTEM = `You help touring comedians localise one reference in a joke. You never rewrite the joke.
Step 1: call find_candidates with every swappable named thing (a brand, chain, store, restaurant, or TV show) copied EXACTLY as written, including script and case. Do not translate. Pick the one best slot (the reference the laugh leans on).
Categories: dining = restaurant chains and fast food brands; retail = shops, grocery chains, fashion and online stores; tv = TV shows; restaurant = a single named local restaurant or bar. Use "none" for anything else (people, places, cities).
role: 2 to 4 plain words for the comic role (for example "fancy grocery store", "cheap fast food", "trashy reality show").
role_keywords: up to 3 from the allowed list for that category that describe the role.
near_punch: true if the slot is in the same sentence as the punchline or in the sentence right before it. false only when the slot sits in an earlier setup sentence and the punch comes later.
Step 2: you will get a numbered shortlist from city data. Call submit_review. Flag only candidates whose NAME clearly touches religion, caste or politics, with a short reason. Set mean_to_locals true only if swapping would turn the joke against the local audience. Do not rank or suggest names.`;

export const TOOLS: ToolDef[] = [
  {
    name: "find_candidates",
    description: "Report the swappable slots in the joke. The server ranks local candidates for the best slot from Qloo city data and returns a shortlist.",
    input_schema: {
      type: "object",
      required: ["slots", "best"],
      properties: {
        best: { type: "integer", description: "index into slots of the one best slot, or -1 if none" },
        slots: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            required: ["text", "category", "role", "role_keywords", "near_punch"],
            properties: {
              text: { type: "string", description: "exact substring of the joke" },
              occurrence: { type: "integer", description: "1 if it is the first time this text appears" },
              category: { type: "string", enum: ["dining", "retail", "tv", "restaurant", "none"] },
              role: { type: "string" },
              role_keywords: { type: "array", items: { type: "string", enum: [...new Set(Object.values(ROLE_VOCAB).flat())] } },
              near_punch: { type: "boolean" },
            },
          },
        },
      },
    },
  },
  {
    name: "submit_review",
    description: "Return safety warnings for the shortlist. Do not reorder.",
    input_schema: {
      type: "object",
      required: ["warnings", "mean_to_locals"],
      properties: {
        warnings: { type: "array", items: { type: "object", required: ["n", "flag", "reason"], properties: { n: { type: "integer" }, flag: { type: "string", enum: ["religion", "caste", "politics"] }, reason: { type: "string" } } } },
        mean_to_locals: { type: "boolean" },
      },
    },
  },
];

interface RawSlot { text: string; occurrence?: number; category: string; role: string; role_keywords?: string[]; near_punch: boolean }

export function toSlots(joke: string, raw: RawSlot[]): FoundSlot[] {
  const out: FoundSlot[] = [];
  for (const r of raw) {
    if (r.category === "none") continue;
    const span = locate(joke, r.text, r.occurrence ?? 1) ?? locate(joke, r.text, 1);
    if (!span) continue; // H11: the slot must be an exact substring
    const after = joke.slice(span.end).replace(/[\s.!?,;:"'”’)\]]+$/u, "");
    out.push({
      text: r.text, category: r.category as Category, role: r.role, roleKeywords: r.role_keywords ?? [], nearPunch: r.near_punch,
      isLastWord: after.trim().length === 0, occurrence: r.occurrence ?? 1, start: span.start, end: span.end,
    });
  }
  return out;
}

/** Code-only step: rank candidates for a slot in a city. No LLM. */
export function rankSlot(city: CityDef, slot: FoundSlot, popularityFloor?: number) {
  if (!city.ships.includes(slot.category)) return { kind: "not_covered" as const, message: shippedNote(city) ?? `${city.name}: not covered for ${CATEGORY_LABEL[slot.category]}.` };
  const pack = getPack(city.name);
  const list = listFor(slot);
  if (!pack || !(pack.lists[list]?.length)) return { kind: "empty" as const, message: `Qloo has no ${CATEGORY_LABEL[slot.category]} data for ${city.name} yet.` };
  if (!verifyLocality(pack, list, city.expect)) return { kind: "locality" as const, message: `Qloo matched a different place for ${city.name}.`, locality: pack.localities[list] ?? null };
  const sl = shortlist({ pack, countryPacks: getCountryPacks(city.country), national: getNational(list, city.country), slot, popularityFloor });
  return { kind: "ok" as const, ...sl, locality: pack.localities[list] ?? null };
}

/** All mentions of the slot, with article fixes. Falls back to the one located span if the text is not a whole word. */
export function swapOut(joke: string, slot: { text: string; start: number; end: number }, name: string): string {
  const all = swapAll(joke, slot.text, name);
  return all.parts.some((p) => p.swap) ? all.text : stitch(joke, slot.start, slot.end, name);
}

function build(joke: string, city: CityDef, slots: FoundSlot[], idx: number, cands: Pick[], warnings: Warning[], extra: { roleLoose: boolean; locality: string | null; meanToLocals: boolean }): Result {
  const slot = slots[idx];
  const codeW: Warning[] = cands.map((c) => ({ c, f: codeFlag(c.name + " " + c.tagNames.join(" ")) })).filter((x) => x.f).map((x) => ({ id: x.c.id, flag: x.f as Flag, reason: `Name or tags touch ${x.f}.` }));
  const all = [...warnings, ...codeW.filter((w) => !warnings.some((x) => x.id === w.id))];
  const { picks, selectedId, onlyShared } = finalize(cands, all);
  const sel = picks.find((p) => p.id === selectedId);
  return {
    status: "ok", joke, city: city.name, slots, slotIndex: idx, picks, selectedId,
    output: sel ? swapOut(joke, slot, sel.name) : joke,
    punchHint: !slot.nearPunch, roleLoose: extra.roleLoose, onlyShared, fewer: picks.length < 3, locality: extra.locality, meanToLocals: extra.meanToLocals,
  };
}

/**
 * The agent loop: Haiku reports slots (tool find_candidates), code ranks Qloo candidates and returns them
 * as the tool result, Haiku returns warnings (tool submit_review). At most 2 LLM calls (AC10).
 */
export async function runAgent(joke: string, city: CityDef, llm: LlmFn, popularityFloor?: number): Promise<Result> {
  const messages: Msg[] = [{ role: "user", content: `City: ${city.name}\nJoke:\n<<<\n${joke}\n>>>\nAllowed role_keywords: ${JSON.stringify(ROLE_VOCAB)}` }];
  let slots: FoundSlot[] = [];
  let idx = -1;
  let ranked: ReturnType<typeof rankSlot> | null = null;

  for (let turn = 0; turn < 2; turn++) {
    const reply = await llm({ system: SYSTEM, messages, tools: TOOLS, toolChoice: turn === 0 ? "find_candidates" : "submit_review", maxTokens: 400 });
    const use = reply.content.find((b) => b.type === "tool_use");
    if (!use || use.type !== "tool_use") throw new Error("bad llm output");
    messages.push({ role: "assistant", content: reply.content });

    if (use.name === "find_candidates") {
      const raw = (use.input.slots ?? []) as RawSlot[];
      const bestText = raw[Number(use.input.best)]?.text;
      slots = toSlots(joke, raw);
      if (!slots.length) return { status: "no_slot" };
      idx = Math.max(0, slots.findIndex((s) => s.text === bestText));
      ranked = rankSlot(city, slots[idx], popularityFloor);
      if (ranked.kind === "not_covered") return { status: "category_not_covered", message: ranked.message, slots, slotIndex: idx };
      if (ranked.kind === "empty") return { status: "qloo_empty", message: ranked.message, slots, slotIndex: idx };
      if (ranked.kind === "locality") return { status: "locality_mismatch", message: ranked.message };
      if (!ranked.candidates.length) return build(joke, city, slots, idx, [], [], { roleLoose: ranked.roleLoose, locality: ranked.locality, meanToLocals: false });
      const list = ranked.candidates.map((c, i) => `${i + 1}. ${c.name} (${c.tagNames.slice(0, 3).join(", ")})`).join("\n");
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: use.id, content: `Shortlist for "${slots[idx].text}" in ${city.name}:\n${list}` }] });
      continue;
    }
    if (use.name === "submit_review" && ranked?.kind === "ok") {
      const cands = ranked.candidates;
      const ws = ((use.input.warnings ?? []) as { n: number; flag: Flag; reason: string }[])
        .filter((w) => cands[w.n - 1]).map((w) => ({ id: cands[w.n - 1].id, flag: w.flag, reason: w.reason }));
      return build(joke, city, slots, idx, cands, ws, { roleLoose: ranked.roleLoose, locality: ranked.locality, meanToLocals: !!use.input.mean_to_locals });
    }
  }
  throw new Error("bad llm output");
}

/** Switch to another slot with no new LLM call (4.2 step 11). Warnings come from the code flag list only. */
export function rerankSlot(joke: string, city: CityDef, slots: FoundSlot[], idx: number, popularityFloor?: number): Result {
  const r = rankSlot(city, slots[idx], popularityFloor);
  if (r.kind === "not_covered") return { status: "category_not_covered", message: r.message, slots, slotIndex: idx };
  if (r.kind === "empty") return { status: "qloo_empty", message: r.message, slots, slotIndex: idx };
  if (r.kind === "locality") return { status: "locality_mismatch", message: r.message };
  return build(joke, city, slots, idx, r.candidates, [], { roleLoose: r.roleLoose, locality: r.locality, meanToLocals: false });
}

/** Without Qloo: one plain Haiku call for the same slot. Code stitches, so only the name changes. */
export async function plainSwap(joke: string, city: CityDef, slot: FoundSlot, llm: LlmFn): Promise<{ name: string; output: string }> {
  // A forced tool keeps the answer to a bare name; free text sometimes came back as musing.
  const reply = await llm({
    system: "You localise one reference in a joke for a comedian. Give only the replacement name.",
    messages: [{ role: "user", content: `City: ${city.name}\nJoke: ${joke}\nReplace "${slot.text}" (${slot.role}) with what a local in ${city.name} would say.` }],
    tools: [{ name: "give_name", description: "The replacement name only, 1 to 6 words.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } }],
    toolChoice: "give_name",
    maxTokens: 600, // the model thinks before answering
  });
  const use = reply.content.find((b) => b.type === "tool_use");
  const t = reply.content.find((b) => b.type === "text");
  const raw = use && use.type === "tool_use" ? String(use.input.name ?? "") : t && t.type === "text" ? t.text : "";
  const name = raw.trim().split("\n")[0].replace(/^["'“]+|["'”.]+$/g, "");
  if (!name || name.length > 60 || name.split(/\s+/).length > 8 || /\?/.test(name)) throw new Error("bad llm output");
  return { name, output: swapOut(joke, slot, name) };
}
