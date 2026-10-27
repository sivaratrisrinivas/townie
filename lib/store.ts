// Server-side store. Uses Upstash Redis (Vercel Marketplace free tier) when its REST env vars exist,
// otherwise an in-memory map (fine for local dev; on Vercel each instance keeps its own copy).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = new Map<string, { v: string; exp: number }>();

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(URL_!, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  if (!r.ok) throw new Error(`store ${r.status}`);
  return ((await r.json()) as { result: unknown }).result;
}

export const storeKind = () => (URL_ && TOKEN ? "redis" : "memory");

export async function get(key: string): Promise<string | null> {
  if (storeKind() === "redis") return (await redis(["GET", key])) as string | null;
  const e = mem.get(key);
  if (!e || e.exp < Date.now()) return null;
  return e.v;
}
export async function set(key: string, v: string, ttlSec: number): Promise<void> {
  if (storeKind() === "redis") { await redis(["SET", key, v, "EX", ttlSec]); return; }
  mem.set(key, { v, exp: Date.now() + ttlSec * 1000 });
}
export async function incrBy(key: string, n: number, ttlSec: number): Promise<number> {
  if (storeKind() === "redis") {
    const v = Number(await redis(["INCRBY", key, n]));
    if (v === n) await redis(["EXPIRE", key, ttlSec]);
    return v;
  }
  const cur = Number((await get(key)) ?? 0) + n;
  const e = mem.get(key);
  mem.set(key, { v: String(cur), exp: e && e.exp > Date.now() ? e.exp : Date.now() + ttlSec * 1000 });
  return cur;
}
export function _resetMemory() { mem.clear(); }

// Lists, used for comic feedback. Newest first; capped length.
const memList = new Map<string, string[]>();
export async function lpushCapped(key: string, v: string, cap: number): Promise<void> {
  if (storeKind() === "redis") { await redis(["LPUSH", key, v]); await redis(["LTRIM", key, 0, cap - 1]); return; }
  const l = memList.get(key) ?? []; l.unshift(v); memList.set(key, l.slice(0, cap));
}
export async function lrange(key: string, n: number): Promise<string[]> {
  if (storeKind() === "redis") return ((await redis(["LRANGE", key, 0, n - 1])) as string[]) ?? [];
  return (memList.get(key) ?? []).slice(0, n);
}
export async function lrem(key: string, v: string): Promise<number> {
  if (storeKind() === "redis") return Number(await redis(["LREM", key, 0, v]));
  const l = memList.get(key) ?? []; const k = l.filter((x) => x !== v); memList.set(key, k); return l.length - k.length;
}
export function _resetLists() { memList.clear(); }
