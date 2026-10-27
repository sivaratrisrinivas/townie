import { describe, expect, it } from "vitest";
import { locate, singleSpanDiff, stitch } from "@/lib/stitch";
import { toSlots } from "@/lib/agent";

const cases = [
  { lang: "English", joke: "I only shop at Whole Foods because I like paying rent for a lemon.", slot: "Whole Foods", to: "Central Market" },
  { lang: "Hinglish", joke: "Yaar, mere papa ke liye Domino's hi fine dining hai, bas extra cheese daal do.", slot: "Domino's", to: "Paradise Biryani" },
  { lang: "Hindi (Devanagari)", joke: "मेरी मम्मी रोज़ रात को Bigg Boss देखती हैं, जैसे वो न्यूज़ हो।", slot: "Bigg Boss", to: "Unstoppable with NBK" },
  { lang: "Devanagari name", joke: "हम सिर्फ़ बिग बाज़ार जाते हैं क्योंकि वहाँ AC मुफ़्त है।", slot: "बिग बाज़ार", to: "DMart" },
];

describe("one swap only (AC1, AC28, H11)", () => {
  for (const c of cases) {
    it(`${c.lang}: output differs from input only in the swapped name`, () => {
      const span = locate(c.joke, c.slot)!;
      const out = stitch(c.joke, span.start, span.end, c.to);
      expect(out.slice(0, span.start)).toBe(c.joke.slice(0, span.start));
      expect(out.slice(span.start + c.to.length)).toBe(c.joke.slice(span.end));
      const d = singleSpanDiff(c.joke, out);
      expect(d.prefix).toBeGreaterThanOrEqual(span.start - 0);
      expect(c.joke.length - d.suffix).toBeLessThanOrEqual(span.end);
    });
  }
  it("rejects slots that are not exact substrings (no translation)", () => {
    const s = toSlots("I love Bigg Boss.", [{ text: "बिग बॉस", category: "tv", role: "reality show", near_punch: true }]);
    expect(s).toEqual([]);
  });
  it("picks the requested occurrence", () => {
    expect(locate("Target, then Target again", "Target", 2)).toEqual({ start: 13, end: 19 });
  });
  it("detects a last-word slot", () => {
    const [s] = toSlots("My dad's idea of fine dining is Olive Garden.", [{ text: "Olive Garden", category: "dining", role: "cheap chain", near_punch: true }]);
    expect(s.isLastWord).toBe(true);
  });
});
