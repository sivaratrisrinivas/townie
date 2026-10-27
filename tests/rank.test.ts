import { describe, expect, it } from "vitest";
import { WEIGHTS, finalize, shortlist, sharedIds, orderPicks, type Slot } from "@/lib/rank";
import type { Pack } from "@/lib/types";
import { item } from "./fixtures";

const slot = (o: Partial<Slot> = {}): Slot => ({ text: "Whole Foods", category: "retail", role: "fancy grocery", roleKeywords: [], isLastWord: false, ...o });
const pack = (city: string, items = [item("a", 1), item("b", 2), item("c", 3), item("d", 4)], list = "retail"): Pack =>
  ({ city, country: "United States", lists: { [list]: items }, localities: { [list]: `${city}, Texas, United States` } });
const others = (ids: string[]) => ["P", "Q", "R", "S", "T", "U"].map((c) => pack(c, ids.map((id, i) => item(id, i + 1))));

describe("scoring weights (AC26, D18)", () => {
  it("uses popularity 0.30 and lift 0.30 and sums to 1", () => {
    expect(WEIGHTS.popularity).toBe(0.3);
    expect(WEIGHTS.lift).toBe(0.3);
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("lift (AC6, D10)", () => {
  it("is national rank minus city rank, 51 when outside the national top 50", () => {
    const national = [item("b", 20), item("x", 1)];
    const { candidates } = shortlist({ pack: pack("Austin"), countryPacks: [pack("Austin")], national, slot: slot() });
    const b = candidates.find((c) => c.id === "b")!;
    const c = candidates.find((c) => c.id === "c")!;
    expect(b.lift).toBe(20 - 2);
    expect(c.nationalRank).toBe(51);
    expect(c.lift).toBe(51 - 3);
    expect(b.evidence).toBe("#2 in Austin, #20 in United States.");
    expect(c.evidence).toBe("#3 in Austin, outside top 50 in United States.");
  });
  it("restaurants never carry lift and never say lift (AC6)", () => {
    const rp = pack("Austin", [item("r1", 1, { popularity: 0.95, tags: ["urn:tag:genre:place:restaurant"] }), item("r2", 2, { popularity: 0.99, tags: ["urn:tag:genre:place:restaurant"] })], "restaurant");
    const { candidates } = shortlist({ pack: rp, countryPacks: [rp], national: [], slot: slot({ category: "restaurant", text: "Joe's" }) });
    for (const c of candidates) { expect(c.lift).toBeNull(); expect(c.evidence).not.toMatch(/lift/i); }
    expect(candidates.find((c) => c.id === "r2")!.evidence).toBe("Popular in Austin (top 1).");
  });
});

describe("shared picks (AC21, AC22, H7)", () => {
  it("an item in the top 10 of 4+ covered cities is shared, never pre-selected, never lift", () => {
    const austin = pack("Austin", [item("s", 1, { popularity: 0.99 }), item("b", 2), item("c", 3), item("d", 4)]);
    const countryPacks = [austin, ...others(["s"]).slice(0, 3)]; // 4 cities with "s" in top 10
    expect(sharedIds(countryPacks, "retail").has("s")).toBe(true);
    const sl = shortlist({ pack: austin, countryPacks, national: [], slot: slot() });
    const s = sl.candidates.find((c) => c.id === "s")!;
    expect(s.shared).toBe(true);
    expect(s.lift).toBeNull();
    expect(s.labels).toContain("Shared pick, popular across United States");
    const f = finalize(sl.candidates, []);
    expect(f.selectedId).not.toBe("s");
    expect(f.picks.map((p) => p.id)).not.toContain("s"); // 3 local picks exist, so shared is not shown
  });
  it("3 cities is not shared", () => {
    expect(sharedIds([pack("Austin"), ...others(["a"]).slice(0, 2)], "retail").has("a")).toBe(false);
  });
  it("shared fills the list only when needed, none pre-selected if only shared", () => {
    const austin = pack("Austin", [item("s", 1)]);
    const sl = shortlist({ pack: austin, countryPacks: [austin, ...others(["s"])], national: [], slot: slot() });
    const f = finalize(sl.candidates, []);
    expect(f.picks.map((p) => p.id)).toEqual(["s"]);
    expect(f.selectedId).toBeNull();
    expect(f.onlyShared).toBe(true);
  });
});

describe("top 3 and warnings (AC3, AC4, D6, D8)", () => {
  const sl = () => shortlist({ pack: pack("Austin"), countryPacks: [pack("Austin")], national: [], slot: slot() }).candidates;
  it("shows up to 3 and pre-selects the best unflagged", () => {
    const f = finalize(sl(), []);
    expect(f.picks.length).toBe(3);
    expect(f.selectedId).toBe(f.picks[0].id);
  });
  it("a flagged top scorer stays listed with its reason, another is selected", () => {
    const c = sl();
    const f = finalize(c, [{ id: c[0].id, flag: "religion", reason: "temple name" }]);
    expect(f.picks[0].warning).toBe("religion");
    expect(f.picks[0].warningReason).toBe("temple name");
    expect(f.selectedId).toBe(f.picks[1].id);
  });
  it("all flagged means none selected", () => {
    const c = sl();
    const f = finalize(c, c.map((x) => ({ id: x.id, flag: "politics" as const, reason: "r" })));
    expect(f.selectedId).toBeNull();
  });
});

describe("postcard, hotels and closed places (AC20, AC23, Q1)", () => {
  const R = "urn:tag:genre:place:restaurant";
  const rp = pack("Austin", [
    item("hotel", 1, { popularity: 0.999, tags: [R, "urn:tag:category:place:hotel"] }),
    item("mall", 2, { popularity: 0.998, tags: [R, "urn:tag:genre:place:shopping"] }),
    item("hall", 3, { popularity: 0.997, tags: [R, "urn:tag:category:place:banquet_hall"] }),
    item("sight", 4, { popularity: 0.996, tags: [R, "urn:tag:genre:place:tourist_attraction"] }),
    item("lux", 5, { popularity: 0.995, tags: [R], priceLevel: 4 }),
    item("closed", 6, { popularity: 0.994, tags: [R], isClosed: true }),
    item("diner", 7, { popularity: 0.9, tags: [R] }),
  ], "restaurant");
  const sl = shortlist({ pack: rp, countryPacks: [rp], national: [], slot: slot({ category: "restaurant", text: "Joe's" }) });
  it("drops hotel, mall and event-hall restaurants", () => {
    expect(sl.candidates.map((c) => c.id)).not.toEqual(expect.arrayContaining(["hotel"]));
    for (const id of ["hotel", "mall", "hall"]) expect(sl.candidates.find((c) => c.id === id)).toBeUndefined();
  });
  it("drops places Qloo marks closed (Q1)", () => {
    expect(sl.candidates.find((c) => c.id === "closed")).toBeUndefined();
  });
  it("landmarks and price level 4 are never pre-selected and carry the postcard label", () => {
    const f = finalize(sl.candidates, []);
    expect(f.selectedId).toBe("diner");
    const sight = sl.candidates.find((c) => c.id === "sight")!;
    expect(sight.postcard).toBe(true);
    expect(sight.labels).toContain("Tourist landmark. Locals may groan.");
    expect(sl.candidates.find((c) => c.id === "lux")!.postcard).toBe(true);
  });
});

describe("rising (AC24, H9)", () => {
  it("top 10% growth is labelled rising and never pre-selected", () => {
    const items = Array.from({ length: 10 }, (_, i) => item(`i${i}`, i + 1, { growth: i === 1 ? 5 : 0, popularity: i === 1 ? 0.99 : 0.8 }));
    const p = pack("Austin", items);
    const sl = shortlist({ pack: p, countryPacks: [p], national: [], slot: slot() });
    const r = sl.candidates.find((c) => c.id === "i1")!;
    expect(r.rising).toBe(true);
    expect(r.labels).toContain("Rising fast in Austin. May date quickly.");
    expect(finalize(sl.candidates, []).selectedId).not.toBe("i1");
  });
});

describe("restaurants (AC25, H10)", () => {
  it("only the city's top 20 by popularity qualify", () => {
    const items = Array.from({ length: 30 }, (_, i) => item(`r${i}`, i + 1, { popularity: 0.99 - i * 0.001, tags: ["urn:tag:genre:place:restaurant"] }));
    const p = pack("Austin", items, "restaurant");
    const sl = shortlist({ pack: p, countryPacks: [p], national: [], slot: slot({ category: "restaurant", text: "x" }) });
    for (const c of sl.candidates) expect(c.cityRank).toBeLessThanOrEqual(20);
  });
  it("within 0.05, brands and TV rank above restaurants", () => {
    const base = { id: "", name: "", category: "dining" as const, cityRank: 1, nationalRank: null, lift: null, popularity: null, syllables: 2, shared: false, postcard: false, rising: false, warning: null, warningReason: null, evidence: "", labels: [], tagNames: [] };
    const o = orderPicks([{ ...base, id: "rest", list: "restaurant", score: 0.8 }, { ...base, id: "brand", list: "dining", score: 0.76 }, { ...base, id: "far", list: "dining", score: 0.6 }]);
    expect(o.map((x) => x.id)).toEqual(["brand", "rest", "far"]);
  });
});

describe("role filter (H1)", () => {
  it("keeps only candidates whose tags match the role keywords", () => {
    const p = pack("Austin", [item("shoe", 1, { tags: ["urn:tag:genre:brand:qloo:footwear"] }), item("dress", 2, { tags: ["urn:tag:genre:brand:qloo:apparel"] })]);
    const sl = shortlist({ pack: p, countryPacks: [p], national: [], slot: slot({ roleKeywords: ["footwear"] }) });
    expect(sl.candidates.map((c) => c.id)).toEqual(["shoe"]);
  });
});
