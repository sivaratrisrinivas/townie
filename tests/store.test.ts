import { afterEach, describe, expect, it, vi } from "vitest";

// A tiny fake of the Upstash REST API: POST a JSON command array, get { result }.
function fakeUpstash() {
  const db = new Map<string, string>();
  const ttl = new Map<string, number>();
  const seen: unknown[][] = [];
  const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
    const cmd = JSON.parse(String(init.body)) as (string | number)[];
    seen.push(cmd);
    const [op, k, a, , e] = cmd as [string, string, string | number, string, number];
    let result: unknown = null;
    if (op === "GET") result = db.get(k) ?? null;
    if (op === "SET") { db.set(k, String(a)); ttl.set(k, e); result = "OK"; }
    if (op === "INCRBY") { const v = Number(db.get(k) ?? 0) + Number(a); db.set(k, String(v)); result = v; }
    if (op === "EXPIRE") { ttl.set(k, Number(a)); result = 1; }
    return new Response(JSON.stringify({ result }), { status: 200 });
  });
  return { db, ttl, seen, fetchFn };
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("store", () => {
  it("falls back to memory without Upstash env vars", async () => {
    vi.stubEnv("KV_REST_API_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    const s = await import("@/lib/store");
    expect(s.storeKind()).toBe("memory");
    await s.set("a", "1", 60);
    expect(await s.get("a")).toBe("1");
    expect(await s.incrBy("n", 5, 60)).toBe(5);
  });

  it("uses Redis when Vercel's Upstash env vars exist, so counters are shared across instances", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://fake.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    const f = fakeUpstash();
    vi.stubGlobal("fetch", f.fetchFn);
    const a = await import("@/lib/store");
    expect(a.storeKind()).toBe("redis");
    expect(await a.incrBy("spend:micro", 700, 100)).toBe(700);
    expect(f.ttl.get("spend:micro")).toBe(100); // expiry set on first write only
    // A second "instance" (fresh module) sees the same counter.
    vi.resetModules();
    const b = await import("@/lib/store");
    expect(await b.incrBy("spend:micro", 300, 100)).toBe(1000);
    expect(f.seen.filter((c) => c[0] === "EXPIRE")).toHaveLength(1);
    await b.set("p:x", "{}", 60);
    expect(await a.get("p:x")).toBe("{}");
  });

  it("also accepts UPSTASH_REDIS_REST_* names", async () => {
    vi.stubEnv("KV_REST_API_URL", ""); vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const s = await import("@/lib/store");
    expect(s.storeKind()).toBe("redis");
  });
});
