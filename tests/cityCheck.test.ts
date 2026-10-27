import { describe, it, expect } from "vitest";
import { cityStatus } from "@/lib/cityCheck";
import { POST } from "@/app/api/townie/route";

const list = [{ name: "Hyderabad" }, { name: "Austin" }];
describe("cityStatus", () => {
  it("blocks while the covered list is still loading (fast entry race)", () => {
    expect(cityStatus("Jaipur", [], false)).toBe("loading");
  });
  it("flags an uncovered city once the list loads", () => {
    expect(cityStatus("Jaipur", list, true)).toBe("unknown");
  });
  it("accepts covered cities and prefixes", () => {
    expect(cityStatus("hyderabad", list, true)).toBe("ok");
    expect(cityStatus("Aus", list, true)).toBe("ok");
  });
  it("defers to the server if the list failed to load", () => {
    expect(cityStatus("Jaipur", [], true)).toBe("ok");
  });
});

describe("server coverage check", () => {
  it("rejects an uncovered city with the friendly message", async () => {
    const r = await POST(new Request("http://x/api/townie", { method: "POST", body: JSON.stringify({ joke: "My parents watch Bigg Boss.", city: "Jaipur" }) }));
    const b = await r.json();
    expect(b.status).toBe("city_not_covered");
    expect(b.message).toMatch(/^Not covered yet\. Covered cities: .*Hyderabad/);
  });
});
