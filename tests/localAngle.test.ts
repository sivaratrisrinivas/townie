import { describe, expect, it } from "vitest";
import { jokeTopic, pickAngle, type Truth } from "@/lib/localAngle";
import data from "@/lib/localTruths.json";
import { parseFeedback, summarize, type Feedback } from "@/lib/feedback";

const t = (o: Partial<Truth>): Truth => ({ city: "Austin", reference: "x", why: "y", category: "commute", spread: "low", verified: "summary", url: "https://example.com/a", ...o });

describe("TN-FIX4 local angle", () => {
  it("reads the joke's topic", () => {
    expect(jokeTopic("Stuck in traffic for three hours on the flyover")).toBe("commute");
    expect(jokeTopic("I had biryani for breakfast")).toBe("food_ritual");
    expect(jokeTopic("My uncle is a dentist.")).toBeNull();
    expect(jokeTopic("In traffic I started a podcast at the signal. Then I ordered lunch and it reached first.", "dining")).toBe("commute");
    expect(jokeTopic("The staff at Applebee's know me.", "dining")).toBe("food_ritual");
  });
  it("picks by category, then spread, then full_text", () => {
    const pool = [t({ reference: "food", category: "food_ritual", spread: "high" }), t({ reference: "low", spread: "low", verified: "full_text" }),
      t({ reference: "med-sum", spread: "medium" }), t({ reference: "med-full", spread: "medium", verified: "full_text" })];
    expect(pickAngle("Austin", "I sat in traffic", undefined, pool)?.reference).toBe("med-full");
    expect(pickAngle("Austin", "I sat in traffic", undefined, pool)?.source).toBe("example.com");
  });
  it("shows nothing when nothing fits", () => {
    expect(pickAngle("Austin", "I sat in traffic", undefined, [t({ category: "weather" })])).toBeNull();
    expect(pickAngle("Austin", "My uncle is a dentist.", undefined, [t({})])).toBeNull();
    expect(pickAngle("Boston", "I sat in traffic", undefined, [t({})])).toBeNull();
  });
  it("bundled pack: 14 cities, https sources, no political Didi item", () => {
    const items = (data as { items: Truth[] }).items;
    expect(new Set(items.map((i) => i.city)).size).toBe(14);
    expect(items.every((i) => i.url.startsWith("https://"))).toBe(true);
    expect(items.some((i) => /didi/i.test(i.reference))).toBe(false);
    expect(pickAngle("Bengaluru", "Stuck in traffic again")?.reference).toBeTruthy();
  });
  it("feedback records which angle was shown", () => {
    const base = { rating: "use", city: "Austin", joke: "j", swapped: "s", session: "abcd1234ef" };
    const a = parseFeedback({ ...base, angle: "Strong BBQ opinions", angleCategory: "food_ritual" }) as Feedback;
    const b = parseFeedback(base) as Feedback;
    expect(a.angle).toBe("Strong BBQ opinions");
    const s = summarize([a, b]);
    expect(s.byAngle.shown.n).toBe(1); expect(s.byAngle.none.n).toBe(1); expect(s.byAngleCategory.food_ritual.use).toBe(1);
  });
});
