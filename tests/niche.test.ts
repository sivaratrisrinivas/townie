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
    expect(cities.shippedNote(austin)).toBeNull();
  });
  it("swaps a musician from the city music list", () => {
    const music = [item("wn", 1, { name: "Willie Nelson", popularity: 0.95 }), item("gc", 2, { name: "Gary Clark Jr.", popularity: 0.9 })];
    const pack: Pack = { city: "Austin", country: "United States", lists: { music }, localities: { music: "Austin, Travis County, Texas, United States" } };
    const r = rank.shortlist({ pack, countryPacks: [pack], national: [item("ts", 1, { name: "Taylor Swift" })], slot: { text: "Taylor Swift", category: "music", role: "pop star", roleKeywords: [], isLastWord: true } });
    expect(r.candidates.map((p) => p.name)).toContain("Willie Nelson");
  });
});

describe("TN-NICHE3", () => {
  it("drops another region's TV show in Bengaluru only", async () => {
    const { wrongLanguage } = await import("@/lib/rank");
    expect(wrongLanguage("Bengaluru", "Survivor Tamil")).toBe(true);
    expect(wrongLanguage("Chennai", "Survivor Tamil")).toBe(false);
    expect(wrongLanguage("Bengaluru", "Comicstaan")).toBe(false);
  });
  it("an entertainment joke still gets a local angle", async () => {
    const { pickAngle } = await import("@/lib/localAngle");
    for (const c of ["Austin", "Mumbai", "Bengaluru", "Chennai"]) expect(pickAngle(c, "I am so old my first concert was Bon Jovi.", "music")).not.toBeNull();
  });
});

describe("TN-LOCAL angle matches the swap", () => {
  it("music swap gets a music line, star swap gets a screen line, no other fallback", async () => {
    const { pickAngle } = await import("@/lib/localAngle");
    expect(pickAngle("Bengaluru", "My first concert was Bon Jovi.", "music")?.category).toBe("music");
    expect(pickAngle("Chennai", "My uncle thinks Tom Cruise is a role model.", "celeb")?.category).toBe("screen");
    expect(pickAngle("Mumbai", "My cousin watches The Kardashians.", "tv")?.category).toBe("screen");
    expect(pickAngle("Austin", "My uncle is a dentist.")).toBeNull();
  });
});
