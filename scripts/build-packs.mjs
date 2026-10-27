// Builds city packs from live Qloo calls into data/packs (git-ignored). Never commit the output.
// Reads QLOO_API_KEY from the environment; the key is never printed.
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "data", "packs");
const BASE = "https://hackathon.api.qloo.com/v2/insights";
const KEY = process.env.QLOO_API_KEY;

const US = ["New York City", "Los Angeles", "Chicago", "Houston", "Austin", "Atlanta", "Boston"];
const IN = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune"];
const RESTAURANT_CITIES = [...US, "Delhi", "Pune"];
const CATS = {
  dining: { "filter.type": "urn:entity:brand", "filter.tags": "urn:tag:genre:brand:dining" },
  retail: { "filter.type": "urn:entity:brand", "filter.tags": "urn:tag:genre:brand:retail" },
  tv: { "filter.type": "urn:entity:tv_show" },
};
// D13: grocery folds into retail. Fetched as its own list so lift compares like with like.
const GROCERY_TAG = { "United States": "urn:tag:wikipedia_category:supermarkets_of_the_united_states", India: "urn:tag:wikipedia_category:supermarkets_of_india" };
const slug = (s) => s.replace(/\s+/g, "_");

if (fs.existsSync(path.join(OUT, "manifest.json")) && !process.env.FORCE_PACKS) {
  console.log("[packs] already built, skipping (set FORCE_PACKS=1 to rebuild)");
  process.exit(0);
}
if (!KEY) {
  console.log("[packs] QLOO_API_KEY not set; skipping pack build. The app will report cities as unavailable.");
  process.exit(0);
}

let calls = 0;
let okCalls = 0;
async function q(params) {
  const url = BASE + "?" + new URLSearchParams({ take: "50", ...params }).toString();
  for (let attempt = 0; attempt < 3; attempt++) {
    calls++;
    try {
      const r = await fetch(url, { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(40000) });
      if (r.ok) { okCalls++; return await r.json(); }
      console.log(`[packs] HTTP ${r.status} for ${params["signal.location.query"]} ${params["filter.type"]}`);
    } catch (e) {
      console.log(`[packs] fetch error: ${e.name}`);
    }
    await new Promise((s) => setTimeout(s, 1500 * (attempt + 1)));
  }
  return null;
}

function slim(e, i) {
  const p = e.properties ?? {};
  return {
    id: e.entity_id,
    name: e.name,
    rank: i + 1,
    popularity: typeof e.popularity === "number" ? e.popularity : null,
    affinity: e.query?.affinity ?? null,
    growth: e.query?.measurements?.audience_growth ?? null,
    tags: (e.tags ?? []).map((t) => t.id).filter((t) => /genre|category|cuisine/.test(t)).slice(0, 25),
    tagNames: (e.tags ?? []).filter((t) => /genre|category/.test(t.id)).map((t) => t.name).slice(0, 6),
    priceLevel: p.price_level ?? null,
    isClosed: p.is_closed ?? null,
    city: p.geocode?.city ?? null,
  };
}
const disamb = (j) => j?.query?.localities?.signal?.disambiguation ?? j?.query?.localities?.filter?.[0]?.disambiguation ?? null;

async function pool(tasks, n = 4) {
  const res = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; res[k] = await tasks[k](); } }));
  return res;
}

const packs = {};
for (const c of [...US, ...IN]) packs[c] = { city: c, country: US.includes(c) ? "United States" : "India", lists: {}, localities: {} };
const national = {};

const tasks = [];
for (const [cat, p] of Object.entries(CATS)) {
  for (const country of ["United States", "India"]) tasks.push(async () => { national[`${cat}|${country}`] = await q({ ...p, "signal.location.query": country }); });
  for (const city of [...US, ...IN]) tasks.push(async () => {
    const j = await q({ ...p, "signal.location.query": city });
    packs[city].localities[cat] = disamb(j);
    packs[city].lists[cat] = (j?.results?.entities ?? []).map(slim);
  });
}
for (const [country, cities] of [["United States", US], ["India", IN]]) {
  const p = { "filter.type": "urn:entity:brand", "filter.tags": GROCERY_TAG[country] };
  tasks.push(async () => { national[`grocery|${country}`] = await q({ ...p, "signal.location.query": country }); });
  for (const city of cities) tasks.push(async () => {
    const j = await q({ ...p, "signal.location.query": city });
    packs[city].localities.grocery = disamb(j);
    packs[city].lists.grocery = (j?.results?.entities ?? []).map(slim);
  });
}
for (const city of RESTAURANT_CITIES) tasks.push(async () => {
  const j = await q({ "filter.type": "urn:entity:place", "filter.tags": "urn:tag:genre:place:restaurant", "filter.location.query": city, "signal.location.query": city });
  packs[city].localities.restaurant = disamb(j);
  packs[city].lists.restaurant = (j?.results?.entities ?? []).map(slim);
});
await pool(tasks);
if (okCalls < tasks.length * 0.8) {
  console.log(`[packs] only ${okCalls} of ${tasks.length} Qloo calls succeeded; not writing packs (check QLOO_API_KEY).`);
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
for (const cat of [...Object.keys(CATS), "grocery"]) for (const country of ["United States", "India"]) {
  const list = (national[`${cat}|${country}`]?.results?.entities ?? []).map(slim);
  fs.writeFileSync(path.join(OUT, `national__${cat}__${slug(country)}.json`), JSON.stringify(list));
}
for (const [city, pk] of Object.entries(packs)) fs.writeFileSync(path.join(OUT, `${slug(city)}.json`), JSON.stringify(pk));
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ builtAt: new Date().toISOString(), calls }));
console.log(`[packs] built ${Object.keys(packs).length} city packs with ${calls} Qloo calls`);
