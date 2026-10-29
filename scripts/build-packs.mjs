// Builds city packs from live Qloo calls into data/packs (git-ignored). Never commit the output.
// Reads QLOO_API_KEY from the environment; the key is never printed.
// TN-LOCAL: entertainment only (musicians, famous people, TV), pushed as local as Qloo allows.
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "data", "packs");
const API = "https://hackathon.api.qloo.com/v2";
const KEY = process.env.QLOO_API_KEY;

const US = ["New York City", "Los Angeles", "Chicago", "Houston", "Austin", "Atlanta", "Boston"];
const IN = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune"];
const CATS = {
  music: { "filter.type": "urn:entity:artist" },
  celeb: { "filter.type": "urn:entity:person" },
  tv: { "filter.type": "urn:entity:tv_show" },
};
// The city's own scene, as words to look up in Qloo's tag search. Only Qloo decides which names come back.
const SCENE = {
  "New York City": ["east coast hip hop"], "Los Angeles": ["west coast hip hop"], Chicago: ["chicago blues", "drill"],
  Houston: ["houston hip hop", "chopped and screwed"], Austin: ["texas country", "red dirt"], Atlanta: ["atlanta hip hop", "trap"],
  Boston: ["boston"], Mumbai: ["bollywood", "marathi"], Delhi: ["punjabi", "bhangra"], Bengaluru: ["kannada", "sandalwood"],
  Hyderabad: ["telugu", "tollywood"], Chennai: ["tamil", "kollywood"], Kolkata: ["bengali", "rabindra sangeet"], Pune: ["marathi"],
};
// Screen words: Qloo keyword tags for the city's own film industry (people and TV).
const SCREEN = { Mumbai: ["hindi cinema", "marathi cinema"], Delhi: ["punjabi cinema", "hindi cinema"], Bengaluru: ["kannada cinema"], Hyderabad: ["telugu cinema"], Chennai: ["tamil cinema"], Kolkata: ["bengali cinema"], Pune: ["marathi cinema"] };
// Off-language: a name tagged only with another Indian language's music or cinema does not land here.
const OWN = { Mumbai: ["hindi", "bollywood", "marathi"], Delhi: ["hindi", "bollywood", "punjabi"], Bengaluru: ["kannada", "sandalwood"], Hyderabad: ["telugu", "tollywood"], Chennai: ["tamil", "kollywood"], Kolkata: ["bengali", "bangla"], Pune: ["marathi", "hindi", "bollywood"] };
const LANGS = ["hindi", "bollywood", "marathi", "punjabi", "kannada", "sandalwood", "telugu", "tollywood", "tamil", "kollywood", "malayalam", "mollywood", "bengali", "bangla", "bhojpuri", "gujarati"];
const langsOf = (e) => new Set((e.tags ?? []).map((t) => (t.id ?? "").toLowerCase()).filter((id) => /:music:|:media:|cinema|film/.test(id)).flatMap((id) => LANGS.filter((l) => id.includes(l))));
const offLanguage = (city, e) => { const own = OWN[city]; if (!own) return false; const ls = langsOf(e); return ls.size > 0 && ![...ls].some((l) => own.includes(l)); };
const DESI = /indian|indi_pop|desi_|filmi|bollywood|tollywood|kollywood|sandalwood|punjabi|bhangra|hindi|tamil|telugu|kannada|bengali|bangla|marathi|malayalam|carnatic|hindustani|ghazal|qawwali|sufi|rabindra|bhajan/;
const political = (e) => !!e.properties?.position_held || (e.tags ?? []).some((t) => /politic|government|legislat|senator|governor|mayor/.test(t.id ?? ""));

if (fs.existsSync(path.join(OUT, "manifest.json")) && !process.env.FORCE_PACKS) {
  console.log("[packs] already built, skipping (set FORCE_PACKS=1 to rebuild)");
  process.exit(0);
}
if (!KEY) {
  console.log("[packs] QLOO_API_KEY not set; skipping pack build. The app will report cities as unavailable.");
  process.exit(0);
}

let calls = 0, okCalls = 0;
const wait = (ms) => new Promise((s) => setTimeout(s, ms));
async function get(p, params) {
  const url = `${API}/${p}?` + new URLSearchParams(params).toString();
  for (let attempt = 0; attempt < 4; attempt++) {
    calls++;
    try {
      const r = await fetch(url, { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(40000) });
      if (r.ok) { okCalls++; await wait(250); return await r.json(); }
      console.log(`[packs] HTTP ${r.status} for ${p} ${params["signal.location.query"] ?? params["filter.query"] ?? ""} ${params["filter.type"] ?? ""}`);
    } catch (e) {
      console.log(`[packs] fetch error: ${e.name}`);
    }
    await wait(2000 * (attempt + 1));
  }
  return null;
}
const q = (params) => get("insights", { take: "50", ...params });

function slim(e, i) {
  const p = e.properties ?? {};
  return {
    id: e.entity_id, name: e.name, rank: i + 1,
    popularity: typeof e.popularity === "number" ? e.popularity : null,
    affinity: e.query?.affinity ?? null,
    growth: e.query?.measurements?.audience_growth ?? null,
    tags: (e.tags ?? []).map((t) => t.id).filter((t) => /genre|category|occupation|language/.test(t)).slice(0, 25),
    tagNames: (e.tags ?? []).filter((t) => /genre|category/.test(t.id)).map((t) => t.name).slice(0, 6),
    priceLevel: null, isClosed: null, city: p.geocode?.city ?? null,
  };
}
const disamb = (j) => j?.query?.localities?.signal?.disambiguation ?? j?.query?.localities?.filter?.[0]?.disambiguation ?? null;
const ents = (j, cat) => (j?.results?.entities ?? []).filter((e) => !(cat === "celeb" && political(e)));

// One call at a time: the hackathon key rate-limits parallel calls.
const packs = {}, national = {}, sceneLog = {};
for (const c of [...US, ...IN]) packs[c] = { city: c, country: US.includes(c) ? "United States" : "India", lists: {}, localities: {}, subs: {} };

for (const [cat, p] of Object.entries(CATS)) for (const country of ["United States", "India"]) national[`${cat}|${country}`] = ents(await q({ ...p, "signal.location.query": country }), cat);

const screenTags = {};
for (const [city, words] of Object.entries(SCREEN)) for (const w of words) {
  const j = await get("tags", { "filter.query": w, take: "10" });
  const ids = (j?.results?.tags ?? []).map((t) => t.id ?? t.tag_id).filter(Boolean);
  const key = w.split(" ")[0];
  const hit = ids.find((id) => id.includes(key) && /cinema|film|media/.test(id) && !/place|cuisine|dish/.test(id));
  (screenTags[city] ??= []).push(...(hit ? [hit] : []));
  sceneLog[`${city}|${w}`] = ids.slice(0, 6);
}
// Scene tags: Qloo's own tag ids for each city's words. Music tags filter musicians; other matches filter TV and people.
const sceneTags = {};
for (const [city, words] of Object.entries(SCENE)) {
  sceneTags[city] = { music: [], other: [] };
  for (const w of words) {
    const j = await get("tags", { "filter.query": w, take: "10" });
    const ids = (j?.results?.tags ?? []).map((t) => t.id ?? t.tag_id).filter(Boolean);
    const key = w.split(" ")[0].toLowerCase();
    const rel = ids.filter((id) => id.toLowerCase().includes(key));
    sceneTags[city].music.push(...rel.filter((id) => /:music/.test(id)).slice(0, 2));
    sceneLog[`${city}|${w}`] = ids.slice(0, 10);
  }
}

for (const city of [...US, ...IN]) {
  const pk = packs[city];
  const usNat = new Map(national[`music|United States`].map((e, i) => [e.entity_id, i]));
  for (const [cat, p] of Object.entries(CATS)) {
    const j = await q({ ...p, "signal.location.query": city });
    pk.localities[cat] = disamb(j);
    let base = ents(j, cat);
    // Scene-filtered list first (most local), then the plain city list.
    const tags = cat === "music" ? sceneTags[city].music : screenTags[city] ?? [];
    let scene = [];
    // One call per tag: Qloo treats a comma list as a match on any, but keep each scene list short and local.
    for (const t of tags) {
      const sj = await q({ ...p, "filter.tags": t, "signal.location.query": city, take: "25" });
      scene.push(...ents(sj, cat));
    }
    // Drop clearly global picks: for India, anything in the US national list; for the US, the national top 10.
    const nat = new Map(national[`${cat}|United States`].map((e, i) => [e.entity_id, i]));
    const global = (e) => (pk.country === "India" ? nat.has(e.entity_id) || (cat === "music" && usNat.has(e.entity_id)) : (nat.get(e.entity_id) ?? 99) < 10);
    const seen = new Set();
    const merged = [...scene, ...base].filter((e) => !global(e) && !offLanguage(city, e) && !seen.has(e.entity_id) && seen.add(e.entity_id));
    // India music: keep only names Qloo tags with an Indian scene, so Coldplay or Shakira cannot stand in for a local.
    const desi = (e) => (e.tags ?? []).some((t) => /:music:|:media:/.test(t.id ?? "") && DESI.test(t.id ?? ""));
    const local = pk.country === "India" && cat === "music" ? merged.filter(desi) : merged;
    const final = local.length >= 12 ? local : merged;
    pk.lists[cat] = final.map(slim);
    console.log(`[packs] ${city} ${cat}: scene ${scene.length} (${tags.join("|") || "no tag"}), kept ${final.length}; top: ${final.slice(0, 5).map((e) => e.name).join(", ")}`);
  }
}
if (okCalls < 40) {
  console.log(`[packs] only ${okCalls} Qloo calls succeeded; not writing packs (check QLOO_API_KEY).`);
  process.exit(0);
}
console.log(`[packs] screen tags ${JSON.stringify(screenTags)}`);
for (const [k, v] of Object.entries(sceneLog)) console.log(`[packs] tags ${k}: ${v.join(" ")}`);

fs.mkdirSync(OUT, { recursive: true });
const slug = (s) => s.replace(/\s+/g, "_");
for (const cat of Object.keys(CATS)) for (const country of ["United States", "India"]) {
  fs.writeFileSync(path.join(OUT, `national__${cat}__${slug(country)}.json`), JSON.stringify(national[`${cat}|${country}`].map(slim)));
}
for (const [city, pk] of Object.entries(packs)) fs.writeFileSync(path.join(OUT, `${slug(city)}.json`), JSON.stringify(pk));
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ builtAt: new Date().toISOString(), calls }));
console.log(`[packs] built ${Object.keys(packs).length} city packs with ${calls} Qloo calls`);
// Fail the build rather than ship empty lists (Qloo throttles when two builds run at once); Vercel then keeps the last good deploy.
const empty = Object.values(packs).flatMap((pk) => Object.entries(pk.lists).filter(([, l]) => !l?.length).map(([c]) => `${pk.city}/${c}`));
if (empty.length > 3) { console.error(`[packs] too many empty lists, failing build: ${empty.join(", ")}`); process.exit(1); }
