/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMP niche probe (TN-NICHE). Preview-only. Never returns the key.
export const maxDuration = 60;
const B = "https://hackathon.api.qloo.com";
async function q(path: string) {
  for (let a = 0; a < 3; a++) {
    const r = await fetch(B + path, { headers: { "X-Api-Key": process.env.QLOO_API_KEY ?? "" }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (r?.status === 429) { await new Promise((s) => setTimeout(s, 3000 * (a + 1))); continue; }
    if (!r) return { err: "fetch" };
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { err: r.status, msg: JSON.stringify(j).slice(0, 200) };
  }
  return { err: 429 };
}
const names = (j: any) => (j?.results?.entities ?? []).map((e: any) => `${e.name}${e.properties?.geocode?.city ? " @" + e.properties.geocode.city : ""}`);
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new Response("no", { status: 404 });
  const u = new URL(req.url); const city = u.searchParams.get("city"); const tags = u.searchParams.get("tags");
  const wait = () => new Promise((s) => setTimeout(s, 1200));
  if (tags) { const out: Record<string, unknown> = {}; for (const t of tags.split(",")) { const j: any = await q(`/v2/tags?filter.query=${encodeURIComponent(t)}&take=8`); out[t] = j?.results?.tags?.map((x: any) => x.id) ?? j; await wait(); } return Response.json(out); }
  if (!city) return new Response("city?", { status: 400 });
  const L = encodeURIComponent(city); const extra = u.searchParams.get("q");
  const plan: Record<string, string> = extra ? { custom: extra.replace("CITY", L) } : {
    sports_team: `/v2/insights?filter.type=urn:entity:brand&filter.tags=${u.searchParams.get("team") ?? "urn:tag:genre:brand:sports_team"}&signal.location.query=${L}&take=10`,
    stadium: `/v2/insights?filter.type=urn:entity:place&filter.tags=urn:tag:genre:place:stadium&filter.location.query=${L}&take=10`,
    athlete: `/v2/insights?filter.type=urn:entity:person&filter.tags=${u.searchParams.get("ath") ?? "urn:tag:genre:person:athlete"}&signal.location.query=${L}&take=10`,
    artist: `/v2/insights?filter.type=urn:entity:artist&signal.location.query=${L}&take=10`,
    tv_show: `/v2/insights?filter.type=urn:entity:tv_show&signal.location.query=${L}&take=10`,
    movie: `/v2/insights?filter.type=urn:entity:movie&signal.location.query=${L}&take=10`,
    podcast: `/v2/insights?filter.type=urn:entity:podcast&signal.location.query=${L}&take=10`,
    person: `/v2/insights?filter.type=urn:entity:person&signal.location.query=${L}&take=10`,
  };
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(plan)) { const j: any = await q(p); out[k] = j?.err ? j : names(j); await wait(); }
  return Response.json(out);
}
