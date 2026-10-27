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
