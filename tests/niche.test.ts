import { beforeAll, describe, expect, it, vi } from "vitest";
import { item } from "./fixtures";
import type { Pack } from "@/lib/types";

// TN-NICHE: with the flag on, cities ship only musicians, stars and TV, and swaps come from those Qloo lists.
let cities: typeof import("@/lib/cities");
let rank: typeof import("@/lib/rank");
beforeAll(async () => {
  vi.stubEnv("TOWNIE_NICHE", "entertainment");
  vi.resetModules();
  cities = await import("@/lib/cities");
  rank = await import("@/lib/rank");
});

describe("niche flag", () => {
  it("ships music, celeb and tv only, and says so for shops", () => {
    expect(cities.CITIES.every((c) => c.ships.join() === "music,celeb,tv")).toBe(true);
    const austin = cities.CITIES.find((c) => c.name === "Austin")!;
    expect(cities.shippedNote(austin)).toMatch(/musicians/);
  });
  it("swaps a musician from the city music list", () => {
    const music = [item("wn", 1, { name: "Willie Nelson", popularity: 0.95 }), item("gc", 2, { name: "Gary Clark Jr.", popularity: 0.9 })];
    const pack: Pack = { city: "Austin", country: "United States", lists: { music }, localities: { music: "Austin, Travis County, Texas, United States" } };
    const r = rank.shortlist({ pack, countryPacks: [pack], national: [item("ts", 1, { name: "Taylor Swift" })], slot: { text: "Taylor Swift", category: "music", role: "pop star", roleKeywords: [], isLastWord: true } });
    expect(r.candidates.map((p) => p.name)).toContain("Willie Nelson");
  });
});
