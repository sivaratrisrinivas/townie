// Builds lib/localTruths.json from the hand-gathered research file (NOT Qloo data).
// Run locally: node scripts/build-truths.mjs [path]. The output is committed and bundled at build time; nothing is scraped at runtime.
import fs from "node:fs";
const src = process.argv[2] ?? "/workspace/townie-research/local_truths.json";
const DROP = [/what's didi doing now/i]; // TN-FIX4: political
const FLAG = /\b(bjp|congress|modi|gandhi|didi|mamata|trump|biden|politic\w*|temple|mosque|church|caste)\b/i;
const d = JSON.parse(fs.readFileSync(src, "utf8"));
const out = [];
for (const [city, items] of Object.entries(d.cities)) for (const i of items) {
  const text = `${i.reference} ${i.why_locals_laugh}`;
  if (DROP.some((r) => r.test(i.reference)) || FLAG.test(text)) continue;
  const url = (i.source_urls ?? [])[0] ?? i.source;
  if (!/^https:\/\//.test(url ?? "")) continue;
  out.push({ city, reference: i.reference, why: i.why_locals_laugh, category: i.category, spread: i.spread, verified: i.verified, url });
}
fs.writeFileSync("lib/localTruths.json", JSON.stringify({ label: "From local sources (Reddit, YouTube, local press), not Qloo.", items: out }, null, 0) + "\n");
console.log(`[truths] ${out.length} items`);
