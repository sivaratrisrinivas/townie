// TEMP probe for TN-Q1. Preview-only. Never returns the key.
export const maxDuration = 60;
const B = "https://hackathon.api.qloo.com";
function trim(o: unknown, d = 0): unknown {
  if (Array.isArray(o)) return [o.length + " items", ...o.slice(0, d ? 2 : 3).map((x) => trim(x, d + 1))];
  if (o && typeof o === "object") { if (d > 4) return "{…}"; return Object.fromEntries(Object.entries(o).slice(0, 25).map(([k, v]) => [k, trim(v, d + 1)])); }
  if (typeof o === "string") return o.length > 140 ? o.slice(0, 140) + "…" : o;
  return o;
}
async function q(path: string) {
  const t = Date.now();
  try {
    const r = await fetch(B + path, { headers: { "X-Api-Key": process.env.QLOO_API_KEY ?? "" }, signal: AbortSignal.timeout(25000) });
    const txt = await r.text(); let body: unknown = txt.slice(0, 400);
    try { body = JSON.parse(txt); } catch {}
    return { path, status: r.status, ms: Date.now() - t, body };
  } catch (e) { return { path, status: 0, ms: Date.now() - t, body: String(e) }; }
}
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new Response("no", { status: 404 });
  const u = new URL(req.url); const part = u.searchParams.get("p") ?? "a";
  const L = "filter.location.query=Austin";
  let paths: string[] = [];
  if (part === "a") paths = [
    "/search?query=Whole%20Foods&take=3", "/search?query=Austin&types=urn:entity:locality&take=3",
    "/search?query=Franklin%20Barbecue&take=3", "/v2/tags/types", "/v2/tags?filter.query=barbecue&take=5",
    "/v2/audiences/types", "/v2/audiences?take=5",
  ];
  const types = ["brand","place","artist","movie","tv_show","book","podcast","videogame","destination","person","locality"];
  if (part === "b") paths = types.map((t) => `/v2/insights?filter.type=urn:entity:${t}&signal.location.query=Austin&take=3`);
  if (part === "c") {
    const s = (await q("/search?query=Whole%20Foods%20Market&take=1")) as { body: { results?: { entity_id: string }[] } };
    const s2 = (await q("/search?query=Trader%20Joe%27s&take=1")) as { body: { results?: { entity_id: string }[] } };
    const id = s.body?.results?.[0]?.entity_id ?? ""; const id2 = s2.body?.results?.[0]?.entity_id ?? "";
    paths = [
      `/entities?entity_ids=${id}`,
      `/v2/insights?filter.type=urn:demographics&signal.interests.entities=${id}`,
      `/v2/insights?filter.type=urn:heatmap&${L}&signal.interests.entities=${id}`,
      `/v2/insights?filter.type=urn:tag&signal.interests.entities=${id}&take=5`,
      `/v2/insights?filter.type=urn:entity:place&${L}&signal.interests.entities=${id}&take=3`,
      `/v2/insights?filter.type=urn:entity:brand&signal.location.query=Austin&signal.demographics.age=35_and_younger&take=3`,
      `/v2/insights/compare?a.signal.interests.entities=${id}&b.signal.interests.entities=${id2}&take=5`,
      `/v2/trending?filter.type=urn:entity:brand&signal.interests.entities=${id}&filter.start_date=2026-07-01&filter.end_date=2026-10-01`,
      `/v2/trending?filter.type=urn:entity:brand&take=5`,
      `/v2/insights?filter.type=urn:entity:locality&signal.interests.entities=${id}&take=3`,
      `/v2/insights?filter.type=urn:entity:place&filter.location.query=Austin&filter.tags=urn:tag:genre:place:restaurant:barbecue&take=3`,
    ];
  }
  const out = await Promise.all(paths.map(q));
  return Response.json(out.map((o) => ({ ...o, body: trim(o.body) })));
}
