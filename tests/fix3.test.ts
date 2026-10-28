// TN-FIX3 regressions. Synthetic fixtures shaped like Qloo items; no Qloo data.
import { describe, expect, it } from "vitest";
import { fitSub, finalize, isOutOfTown, listFor, shortlist } from "@/lib/rank";
import { itemSubs, slotSub } from "@/lib/subcat";
import { articleFor, swapAll } from "@/lib/stitch";
import { item } from "./fixtures";
import type { Pack } from "@/lib/types";

const wc = (s: string) => `urn:tag:wikipedia_category:${s}`;
const dining = (city: string, items: ReturnType<typeof item>[], subs: Pack["subs"] = {}): Pack =>
  ({ city, country: "United States", lists: { dining: items }, localities: { dining: `${city}, Texas, United States` }, subs });
const slot = (text: string, role: string, kw: string[] = [], category: "dining" | "retail" = "dining") => ({ text, category, role, roleKeywords: kw, isLastWord: false });
const pick = (pack: Pack, s: ReturnType<typeof slot>) => {
  const sl = shortlist({ pack, countryPacks: [pack], national: [], slot: s });
  const f = finalize(sl.candidates, []);
  return f.picks.find((p) => p.id === f.selectedId)?.name ?? null;
};

const steak = item("ev", 5, { name: "Eddie V's", tags: [wc("steakhouses_in_the_united_states")] });
const bakery = item("bk", 1, { name: "Sugar Cakes", tags: ["urn:tag:genre:brand:bakery"] });
const coffee = item("cf", 3, { name: "Bean Box", tags: [wc("coffee_houses_of_the_united_states")] });
const pizza = item("pz", 9, { name: "Pie Town", tags: [wc("pizza_chains_of_the_united_states")] });
const taco = item("tc", 7, { name: "Taco Loco", tags: [wc("fast_food_mexican_restaurants")] });
const eggs = item("eg", 2, { name: "Egg Stand", tags: [wc("restaurants_in_los_angeles")] });
const austin = dining("Austin", [bakery, eggs, coffee, steak, taco]);

describe("TN-FIX3 sub-category fit", () => {
  it("classifies originals by what they do in the joke", () => {
    expect(slotSub(slot("Domino's", "cheap fast food", ["fast_food"]))).toBe("pizza");
    expect(slotSub(slot("Starbucks", "chain"))).toBe("coffee");
    expect(slotSub(slot("Applebee's", "chain restaurant"))).toBe("sitdown");
    expect(slotSub(slot("Costco", "bulk store", ["supermarket"], "retail"))).toBe("bigbox");
  });
  it("pizza stays pizza, coffee stays coffee, ribs go to a sit-down place", () => {
    expect(pick(austin, slot("Starbucks", "coffee chain", ["coffee"]))).toBe("Bean Box");
    expect(pick(austin, slot("Applebee's", "chain restaurant"))).toBe("Eddie V's");
    expect(pick(austin, slot("Chipotle", "burrito chain"))).toBe("Taco Loco");
    // No pizza on the main list: Qloo's city pizza sub-list supplies it.
    expect(pick(dining("Austin", [bakery, coffee], { pizza: [pizza] }), slot("Domino's", "pizza chain", ["pizza"]))).toBe("Pie Town");
  });
  it("returns no pick rather than a wrong-kind one", () => {
    expect(fitSub([bakery, coffee], "pizza").items).toEqual([]);
    expect(pick(dining("Austin", [bakery, coffee]), slot("Domino's", "pizza chain"))).toBeNull();
  });
  it("a veggie or burger 'grill' is not a sit-down rib place", () => {
    expect(itemSubs({ name: "Veggie Grill", tags: [] }).has("sitdown")).toBe(false);
    expect(itemSubs({ name: "Rainbow Bar and Grill", tags: [] }).has("sitdown")).toBe(true);
  });
});

describe("TN-FIX3 diversity and city truth", () => {
  it("drops items Qloo places in another city", () => {
    expect(isOutOfTown(eggs, "New York City", "New York, New York, United States")).toBe(true);
    expect(isOutOfTown(eggs, "Los Angeles", "Los Angeles, California, United States")).toBe(false);
  });
  it("different jokes in one city get different picks", () => {
    const names = [slot("Starbucks", "coffee"), slot("Applebee's", "chain restaurant"), slot("Chipotle", "burrito")].map((s) => pick(austin, s));
    expect(new Set(names).size).toBe(3);
    expect(names).not.toContain("Egg Stand");
  });
});

describe("TN-FIX3 retail coverage", () => {
  const disc = item("99", 30, { name: "Dollar Depot", popularity: 0.8, tags: [wc("discount_stores_of_the_united_states")] });
  const lux = item("lx", 1, { name: "Fancy Mart", tags: ["urn:tag:genre:brand:retail"] });
  const la: Pack = { city: "Los Angeles", country: "United States", lists: { retail: [lux, disc], grocery: [] }, localities: { retail: "Los Angeles, California, United States" } };
  it("Target and Costco go to the retail list and get a local big box", () => {
    expect(listFor(slot("Costco", "bulk club", ["grocery", "supermarket"], "retail"))).toBe("retail");
    expect(pick(la, slot("Target", "big box store", ["department"], "retail"))).toBe("Dollar Depot");
    expect(pick(la, slot("Costco", "bulk warehouse club", ["supermarket"], "retail"))).toBe("Dollar Depot");
  });
});

describe("TN-FIX3 articles and repeated mentions", () => {
  it("fixes a/an before the swapped name", () => {
    expect(swapAll("ribs out of an Applebee's bag", "Applebee's", "Del Taco").text).toBe("ribs out of a Del Taco bag");
    expect(swapAll("I grabbed a Starbucks", "Starbucks", "Eddie V's").text).toBe("I grabbed an Eddie V's");
    expect(swapAll("A Wendy's opened", "Wendy's", "In-N-Out").text).toBe("An In-N-Out opened");
    expect(articleFor("H MART")).toBe("an");
    expect(articleFor("Uniqlo")).toBe("a");
  });
  it("swaps every mention so callbacks land, and nothing else", () => {
    const j = "Day one, Chipotle. Day two, Chipotle. Chipotles everywhere.";
    const r = swapAll(j, "Chipotle", "Chuy's");
    expect(r.text).toBe("Day one, Chuy's. Day two, Chuy's. Chipotles everywhere.");
    expect(r.parts.filter((p) => p.swap).length).toBe(2);
  });
});

describe("TN-FIX3 sayable names", () => {
  it("drops a trailing Restaurant or Stores from Qloo names", async () => {
    const { spoken } = await import("@/lib/rank");
    expect(spoken("Chuy's Restaurant")).toBe("Chuy's");
    expect(spoken("99 Cents Only Stores")).toBe("99 Cents Only");
    expect(spoken("Whole Foods Market")).toBe("Whole Foods Market");
  });
});

describe("TN-FIX3 reviewer false flags", () => {
  it("ignores a warning whose reason says there is no risk", async () => {
    const { isNonFlag } = await import("@/lib/agent");
    expect(isNonFlag("the candidate 'California Pizza Kitchen' does not touch those topics, so this is a non-flag.")).toBe(true);
    expect(isNonFlag("Name does not clearly touch religion; flagged only as a precaution.")).toBe(true);
    expect(isNonFlag("Name refers to a Hindu deity.")).toBe(false);
  });
});
