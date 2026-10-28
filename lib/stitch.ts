/** Replace exactly one span. Everything outside [start, end) is byte-identical (AC1, AC28). */
export function stitch(joke: string, start: number, end: number, replacement: string): string {
  if (start < 0 || end > joke.length || start >= end) throw new Error("bad span");
  return joke.slice(0, start) + replacement + joke.slice(end);
}

/** Find the slot text in the joke. Returns the first exact occurrence, or the nth if occurrence is given. */
export function locate(joke: string, text: string, occurrence = 1): { start: number; end: number } | null {
  if (!text) return null;
  let from = 0;
  for (let k = 1; ; k++) {
    const i = joke.indexOf(text, from);
    if (i < 0) return null;
    if (k === occurrence) return { start: i, end: i + text.length };
    from = i + 1;
  }
}

/** Diff check used in tests: the output differs from the input only inside one span. */
export function singleSpanDiff(a: string, b: string): { prefix: number; suffix: number } {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { prefix: p, suffix: s };
}

/** "a" or "an" for a name, by its first sound. Acronym letters like "H MART" or "FBI" read by letter name. */
export function articleFor(name: string): "a" | "an" {
  const w = name.trim().replace(/^[^A-Za-z0-9]+/, "");
  const first = w.split(/[\s-]/)[0] ?? "";
  if (/^[A-Z]{1,4}$/.test(first) || /^[A-Z]{2,}$/.test(first.replace(/[^A-Za-z]/g, "")) && first.length <= 5) return /^[AEFHILMNORSX]/.test(first) ? "an" : "a";
  if (/^(uni|use|usu|eu|one|once|ubi)/i.test(w)) return "a";
  if (/^(hour|honest|honor|heir)/i.test(w)) return "an";
  if (/^8|^11|^18/.test(w)) return "an";
  return /^[aeiou]/i.test(w) ? "an" : "a";
}

export interface Part { text: string; swap?: boolean }

/**
 * TN-FIX3: swap EVERY whole-word occurrence of the slot so callbacks still land, and fix the
 * article right before each swap ("an Applebee's bag" -> "a Del Taco bag"). Nothing else changes.
 */
export function swapAll(joke: string, text: string, name: string): { parts: Part[]; text: string } {
  const parts: Part[] = [];
  const esc = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "gu");
  let last = 0;
  for (const m of joke.matchAll(re)) {
    let before = joke.slice(last, m.index);
    before = before.replace(/(^|[^\p{L}])(a|an|A|An|AN)(\s+)$/u, (_, pre, art, sp) => {
      const want = articleFor(name);
      const cased = art[0] === art[0].toUpperCase() ? want[0].toUpperCase() + want.slice(1) : want;
      return pre + cased + sp;
    });
    if (before) parts.push({ text: before });
    parts.push({ text: name, swap: true });
    last = m.index! + m[0].length;
  }
  if (last < joke.length) parts.push({ text: joke.slice(last) });
  if (!parts.some((p) => p.swap)) return { parts: [{ text: joke }], text: joke };
  return { parts, text: parts.map((p) => p.text).join("") };
}
