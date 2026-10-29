import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmFn, LlmReply } from "@/lib/llm";
import { item, writePacks } from "./fixtures";
import type { Pack } from "@/lib/types";

const austinItems = [item("cm", 1, { name: "Central Market", tags: ["urn:tag:wikipedia_category:supermarkets_of_the_united_states"] }), item("hm", 2, { name: "H Mart" }), item("sp", 3, { name: "Sprouts" }), item("kr", 4, { name: "Kroger" })];
const mk = (city: string, items = austinItems, expect = `${city}, Travis County, Texas, United States`): Pack => ({ city, country: "United States", lists: { music: items, tv: items }, localities: { music: expect, tv: expect } });

let mod: typeof import("@/lib/agent");
let cities: typeof import("@/lib/cities");
beforeAll(async () => {
  process.env.TOWNIE_PACK_DIR = writePacks([mk("Austin"), { ...mk("Houston"), localities: { music: "Houston County, Alabama, United States" } }], { "music__United_States": [item("kr", 1, { name: "Kroger" })] });
  mod = await import("@/lib/agent");
  cities = await import("@/lib/cities");
});

const reply = (name: string, input: Record<string, unknown>): LlmReply => ({ content: [{ type: "tool_use", id: "t" + name, name, input }], usage: { input_tokens: 500, output_tokens: 80 } });
function fakeLlm(slots: unknown[], warnings: unknown[] = []) {
  const calls: string[] = [];
  const fn: LlmFn = async ({ toolChoice }) => {
    calls.push(toolChoice ?? "text");
    if (toolChoice === "find_candidates") return reply("find_candidates", { slots, best: 0 });
    if (toolChoice === "submit_review") return reply("submit_review", { warnings, mean_to_locals: false });
    return { content: [{ type: "text", text: "HEB" }], usage: { input_tokens: 100, output_tokens: 5 } };
  };
  return { fn, calls };
}
const JOKE = "I only shop at Whole Foods because I like paying rent for a lemon.";
const grocerySlot = (near_punch: boolean) => ({ text: "Whole Foods", category: "music", role: "fancy grocery", role_keywords: [], near_punch });

describe("agent loop", () => {
  it("uses at most 2 LLM calls and swaps one span (AC10, AC1)", async () => {
    const { fn, calls } = fakeLlm([grocerySlot(true)]);
    const r = await mod.runAgent(JOKE, cities.resolveCity("Austin")!, fn);
    expect(calls).toEqual(["find_candidates", "submit_review"]);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    const sel = r.picks.find((p) => p.id === r.selectedId)!;
    expect(r.output).toBe(JOKE.replace("Whole Foods", sel.name));
    expect(r.punchHint).toBe(false);
  });
  it("shows the punch hint when the slot is far from the punch, and still selects (AC27)", async () => {
    const { fn } = fakeLlm([grocerySlot(false)]);
    const r = await mod.runAgent(JOKE, cities.resolveCity("Austin")!, fn);
    expect(r.status === "ok" && r.punchHint).toBe(true);
    expect(r.status === "ok" && r.selectedId).toBeTruthy();
  });
  it("LLM warnings map to candidates and block pre-selection (AC4)", async () => {
    const { fn } = fakeLlm([grocerySlot(true)], [{ n: 1, flag: "religion", reason: "test" }]);
    const r = await mod.runAgent(JOKE, cities.resolveCity("Austin")!, fn);
    if (r.status !== "ok") throw new Error(r.status);
    const flagged = r.picks.find((p) => p.warning === "religion")!;
    expect(flagged).toBeTruthy();
    expect(r.selectedId).not.toBe(flagged.id);
  });
  it("uncovered category for a city gives the ship note (AC7)", async () => {
    const { fn, calls } = fakeLlm([{ text: "Olive Garden", category: "dining", role: "cheap chain", near_punch: true }]);
    const r = await mod.runAgent("My dad loves Olive Garden.", cities.resolveCity("Hyderabad")!, fn);
    expect(r).toMatchObject({ status: "category_not_covered", message: expect.stringMatching(/^Hyderabad: Townie only swaps musicians, famous people and TV shows/) });
    expect(calls.length).toBe(1);
  });
  it("no slot found", async () => {
    const { fn } = fakeLlm([]);
    expect((await mod.runAgent("Why did the chicken cross the road?", cities.resolveCity("Austin")!, fn)).status).toBe("no_slot");
  });
  it("rejects a pack whose locality matched the wrong place (AC19)", async () => {
    const { fn } = fakeLlm([grocerySlot(true)]);
    expect((await mod.runAgent(JOKE, cities.resolveCity("Houston")!, fn)).status).toBe("locality_mismatch");
  });
  it("Without Qloo changes only the slot (D9, AC28)", async () => {
    const { fn, calls } = fakeLlm([]);
    const slot = mod.toSlots(JOKE, [grocerySlot(true)])[0];
    const p = await mod.plainSwap(JOKE, cities.resolveCity("Austin")!, slot, fn);
    expect(p.output).toBe(JOKE.replace("Whole Foods", "HEB"));
    expect(calls.length).toBe(1);
  });
});

describe("cities (AC7, AC19)", () => {
  it("'New York' is corrected to New York City", () => {
    expect(cities.resolveCity("New York")?.name).toBe("New York City");
    expect(cities.resolveCity("Bangalore")?.name).toBe("Bengaluru");
    expect(cities.resolveCity("Jaipur")).toBeNull();
  });
  it("ship matrix notes", () => {
    const n = (c: string) => cities.shippedNote(cities.resolveCity(c)!);
    expect(n("Austin")).toBeNull();
    expect(n("Mumbai")).toBeNull();
    expect(cities.CITIES.every((c) => c.ships.join() === "music,celeb,tv")).toBe(true);
    expect(cities.CITIES.length).toBe(14);
  });
});

describe("limits (AC11)", () => {
  beforeEach(async () => (await import("@/lib/store"))._resetMemory());
  it("21st uncached run from one IP is refused", async () => {
    const { takeVisitor } = await import("@/lib/limits");
    for (let i = 0; i < 20; i++) expect(await takeVisitor("1.2.3.4", "run")).toBe(true);
    expect(await takeVisitor("1.2.3.4", "run")).toBe(false);
    expect(await takeVisitor("5.6.7.8", "run")).toBe(true);
  });
  it("global guard trips at a lowered cap", async () => {
    const L = await import("@/lib/limits");
    L.LIMITS.llmPerDay = 2;
    expect(await L.budgetOpen()).toBe(true);
    await L.recordCall({ input_tokens: 10, output_tokens: 1 });
    await L.recordCall({ input_tokens: 10, output_tokens: 1 });
    expect(await L.budgetOpen()).toBe(false);
    L.LIMITS.llmPerDay = 1000;
  });
  it("spend cap trips at $3", async () => {
    const L = await import("@/lib/limits");
    await L.recordCall({ input_tokens: 30_000_000, output_tokens: 0 }); // $3.00
    expect(await L.spendUsd()).toBeCloseTo(3, 5);
    expect(await L.budgetOpen()).toBe(false);
  });
});
