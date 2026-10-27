import { beforeEach, describe, expect, it } from "vitest";
import { parseFeedback, summarize, type Feedback } from "@/lib/feedback";
import { _resetLists, _resetMemory } from "@/lib/store";
import { POST, DELETE } from "@/app/api/feedback/route";
import { GET } from "@/app/api/feedback/summary/route";

const good = { rating: "use", city: "Hyderabad", joke: "My parents watch Telugu Indian Idol.", original: "Bigg Boss", swapped: "Telugu Indian Idol", category: "tv", list: "tv", popularity: 0.95, lift: 48, rising: false, nearPunch: true, rank: 1, others: ["Cricket ka Ticket"], note: "", session: "abcd1234-ef" };
const post = (b: unknown, ip = "1.2.3.4") => POST(new Request("http://x/api/feedback", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(b) }));
const TOKEN = "t".repeat(40);

beforeEach(() => { _resetMemory(); _resetLists(); process.env.FEEDBACK_ADMIN_TOKEN = TOKEN; });

describe("parseFeedback", () => {
  it("rejects bad ratings, missing swap and bad session", () => {
    expect(typeof parseFeedback({ ...good, rating: "meh" })).toBe("string");
    expect(typeof parseFeedback({ ...good, swapped: "" })).toBe("string");
    expect(typeof parseFeedback({ ...good, session: "x" })).toBe("string");
  });
  it("truncates the joke to 500 and the note to 280, and stores no IP", () => {
    const f = parseFeedback({ ...good, joke: "a".repeat(900), note: "b".repeat(900), ip: "9.9.9.9" }) as Feedback;
    expect(f.joke.length).toBe(500); expect(f.note.length).toBe(280);
    expect(JSON.stringify(f)).not.toContain("9.9.9.9");
  });
});

describe("feedback API", () => {
  it("saves, summarises for the admin only, and deletes", async () => {
    const r = await post({ ...good, note: "Try a Telugu serial" }); const { id } = await r.json();
    await post({ ...good, rating: "wrong", city: "Austin", lift: 5, popularity: 0.6, rising: true });
    expect((await GET(new Request("http://x/s"))).status).toBe(401);
    expect((await GET(new Request("http://x/s", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    const s = await (await GET(new Request("http://x/s", { headers: { authorization: `Bearer ${TOKEN}` } }))).json();
    expect(s.total).toBe(2); expect(s.byRating).toEqual({ use: 1, close: 0, wrong: 1 });
    expect(s.byCity.Hyderabad.hitRate).toBe(1); expect(s.byRising.rising.wrong).toBe(1);
    expect(s.latestNotes[0].note).toBe("Try a Telugu serial");
    expect((await DELETE(new Request(`http://x/api/feedback?id=${id}`))).status).toBe(401);
    const d = await (await DELETE(new Request(`http://x/api/feedback?id=${id}`, { headers: { authorization: `Bearer ${TOKEN}` } }))).json();
    expect(d.removed).toBe(1);
  });
  it("rate-limits per IP", async () => {
    process.env.TOWNIE_FEEDBACK_PER_IP = "2";
    expect((await post(good, "5.5.5.5")).status).toBe(200);
    expect((await post(good, "5.5.5.5")).status).toBe(200);
    expect((await post(good, "5.5.5.5")).status).toBe(429);
    delete process.env.TOWNIE_FEEDBACK_PER_IP;
  });
  it("rejects invalid input with 400", async () => {
    expect((await post({ ...good, rating: "x" })).status).toBe(400);
  });
});

describe("summarize", () => {
  it("buckets popularity and lift", () => {
    const f = parseFeedback(good) as Feedback;
    const s = summarize([f]);
    expect(s.byPopularity["0.9+"].use).toBe(1); expect(s.byLift["30+"].n).toBe(1); expect(s.byCategory.tv.hitRate).toBe(1);
  });
});
