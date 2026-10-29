// TEMP probe for HG-1. Preview-only. Never returns the key. One Qloo call per request.
export const maxDuration = 60;
const B = "https://hackathon.api.qloo.com";
type E = Record<string, any>;
function slim(e: E) {
  const p = e.properties ?? {};
  return {
    n: e.name, id: e.entity_id, t: (e.types ?? []).join(","), s: e.query?.affinity ?? e.popularity,
    ctry: p.country ?? p.geocode?.country_code ?? e.location?.country ?? p.address?.split(",").slice(-1)[0],
    addr: p.address, lang: p.language ?? p.languages ?? p.original_language,
    rel: p.release_year ?? p.release_date ?? p.publication_year, orig: p.origin ?? p.hometown ?? p.place_of_birth,
    keys: Object.keys(p).join(","),
    tags: (e.tags ?? []).slice(0, 12).map((x: E) => x.name).join("|"),
  };
}
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new Response("no", { status: 404 });
  const path = new URL(req.url).searchParams.get("q") ?? "";
  if (!/^\/(search|v2\/insights|entities|v2\/tags|geospatial)/.test(path)) return new Response("bad", { status: 400 });
  const r = await fetch(B + path, { headers: { "X-Api-Key": process.env.QLOO_API_KEY ?? "" }, signal: AbortSignal.timeout(25000) });
  const txt = await r.text(); let j: any; try { j = JSON.parse(txt); } catch { return Response.json({ status: r.status, raw: txt.slice(0, 600) }); }
  const list = j?.results?.entities ?? j?.results ?? j?.entities;
  if (Array.isArray(list)) return Response.json({ status: r.status, n: list.length, items: list.map(slim) });
  return Response.json({ status: r.status, raw: JSON.stringify(j).slice(0, 1500) });
}
