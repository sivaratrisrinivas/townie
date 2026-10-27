import fs from "node:fs";
import path from "node:path";
import type { Country } from "./cities";
import { CITIES, slug } from "./cities";
import type { Item, ListKey, Pack } from "./types";

const dir = () => process.env.TOWNIE_PACK_DIR; // test override
function readFile(file: string): string {
  const d = dir();
  return d ? fs.readFileSync(/*turbopackIgnore: true*/ path.join(d, file), "utf8") : fs.readFileSync(path.join(process.cwd(), "data", "packs", file), "utf8");
}
const cache = new Map<string, unknown>();
function readJson<T>(file: string): T | null {
  if (cache.has(file)) return cache.get(file) as T;
  try {
    const v = JSON.parse(readFile(file)) as T;
    cache.set(file, v);
    return v;
  } catch {
    return null;
  }
}

export const getPack = (city: string) => readJson<Pack>(`${slug(city)}.json`);
export const getNational = (list: ListKey, country: Country) =>
  list === "restaurant" ? [] : readJson<Item[]>(`national__${list}__${slug(country)}.json`) ?? [];
export const getCountryPacks = (country: Country) =>
  CITIES.filter((c) => c.country === country).map((c) => getPack(c.name)).filter((p): p is Pack => !!p);
export const packsReady = () => !!readJson("manifest.json");

/** AC19: the pack's recorded locality must match the expected city. */
export function verifyLocality(pack: Pack, list: ListKey, expect: string): boolean {
  const d = pack.localities[list];
  return !!d && d.includes(expect);
}
