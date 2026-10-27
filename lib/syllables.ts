import { syllable } from "syllable";

/** Syllables for a name. English words use the `syllable` package; names that look non-English fall back to vowel groups. */
export function countSyllables(name: string): number {
  const words = name.replace(/[^\p{L}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  let n = 0;
  for (const w of words) {
    if (/^[A-Z]{2,5}$/.test(w)) { n += w.length; continue; } // acronyms like "HEB" are spelled out
    if (/[^\x00-\x7F]/.test(w)) { n += vowelGroups(w); continue; }
    n += Math.max(1, syllable(w));
  }
  return Math.max(1, n);
}

export function vowelGroups(w: string): number {
  const m = w.toLowerCase().match(/[aeiouyàâäéèêëîïôöûüāīū\u0900-\u097F]+/g);
  return Math.max(1, m ? m.length : 1);
}

/** Ends on a hard consonant or a likely stressed closed syllable. Crude on purpose: it is a 0.10 weight. */
export function hardEnding(name: string): boolean {
  const last = name.trim().split(/\s+/).at(-1)?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return /[bcdgkpqtxz]$|ck$|rt$|st$/.test(last);
}
