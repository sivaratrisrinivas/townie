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
  const W = "1E5D90F5-5E0D-4486-B651-D0E7B8A6BE23", F = "CE9EE2BD-D7AE-4349-B627-3D051D98AE77";
  if (part === "c") paths = [
    `/entities?entity_ids=${W}`,
    `/v2/insights?filter.type=urn:demographics&signal.interests.entities=${W}`,
    `/v2/insights?filter.type=urn:heatmap&${L}&signal.interests.entities=${W}`,
    `/v2/insights?filter.type=urn:tag&signal.interests.entities=${W}&take=5`,
    `/v2/insights?filter.type=urn:entity:destination&signal.location.query=Austin&take=3`,
    `/v2/insights?filter.type=urn:entity:locality&signal.interests.entities=${F}&take=5`,
  ];
  if (part === "d") paths = [
    `/v2/insights/compare?a.signal.interests.entities=${W}&b.signal.interests.entities=${F}&take=5`,
    `/v2/trending?filter.type=urn:entity:brand&signal.interests.entities=${W}&filter.start_date=2026-07-01&filter.end_date=2026-10-01`,
    `/v2/trending?filter.type=urn:entity:brand&take=5`,
    `/v2/insights?filter.type=urn:entity:place&${L}&filter.tags=urn:tag:genre:place:restaurant:barbecue&take=3`,
    `/v2/insights?filter.type=urn:entity:brand&signal.location.query=Austin&signal.demographics.age=35_and_younger&take=3`,
    `/v2/insights?filter.type=urn:tag&signal.location.query=Austin&take=8`,
  ];
  const out = []; for (const x of paths) { out.push(await q(x)); await new Promise((r) => setTimeout(r, 2500)); }
  return Response.json(out.map((o) => ({ ...o, body: trim(o.body) })));
}
