// Synthetic fixtures. Not Qloo data: names and numbers are made up for tests.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Item, Pack } from "@/lib/types";

export const item = (id: string, rank: number, o: Partial<Item> = {}): Item => ({
  id, name: o.name ?? `Brand ${id}`, rank, popularity: 0.9, affinity: 1 - rank / 100, growth: 0, tags: ["urn:tag:genre:brand:retail"], tagNames: ["Retail"], priceLevel: null, isClosed: null, city: null, ...o,
});

export function writePacks(packs: Pack[], national: Record<string, Item[]>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "townie-packs-"));
  for (const p of packs) fs.writeFileSync(path.join(dir, `${p.city.replace(/\s+/g, "_")}.json`), JSON.stringify(p));
  for (const [k, v] of Object.entries(national)) fs.writeFileSync(path.join(dir, `national__${k}.json`), JSON.stringify(v));
  fs.writeFileSync(path.join(dir, "manifest.json"), "{}");
  return dir;
}
