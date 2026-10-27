import type { Category } from "./cities";
import type { Flag, Item, ListKey, Pack, Pick } from "./types";
import { countSyllables, hardEnding } from "./syllables";

// D18 soft weights. Sum is 1.00 (AC26).
export const WEIGHTS = { popularity: 0.3, lift: 0.3, syllables: 0.15, stress: 0.1, nonCliche: 0.1, sayable: 0.05 } as const;

export const POPULARITY_FLOOR = 0.7; // H2
export const LIFT_CAP = 30; // lift above this earns no extra score, so niche items don't win
export const SHARED_MIN_CITIES = 4; // H7: top 10 of 4 or more of 7 covered cities
export const RESTAURANT_TOP = 20; // H10
export const CLOSE_SCORE = 0.05; // H10 tie rule
export const RISING_PCT = 0.1; // H9

const RESTAURANT_DROP = /:(hotel|resort_hotel|shopping|shopping_mall|shopping_center|mall|event_venue|banquet_hall|convention_center)$|:hotel:|restaurant:banquet_hall/;
const POSTCARD = /(genre|category):place:(tourist_attraction|landmark|historical_landmark|attraction)$/;

export interface Slot {
  text: string;
  category: Category;
  role: string;
  roleKeywords: string[];
  isLastWord: boolean;
}

export function listFor(slot: { category: Category; roleKeywords: string[] }): ListKey {
  if (slot.category === "retail" && slot.roleKeywords.some((k) => /grocer|supermarket/.test(k))) return "grocery";
  return slot.category;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, "");

export function isRestaurantDropped(it: Item): boolean {
  return it.tags.some((t) => RESTAURANT_DROP.test(t));
}
export function isPostcard(it: Item): boolean {
  return it.tags.some((t) => POSTCARD.test(t)) || it.priceLevel === 4;
}

/** H7: ids in the top 10 of SHARED_MIN_CITIES or more covered cities of the country (AC22). */
export function sharedIds(countryPacks: Pack[], list: ListKey): Set<string> {
  const counts = new Map<string, number>();
  for (const p of countryPacks) for (const it of (p.lists[list] ?? []).slice(0, 10)) counts.set(it.id, (counts.get(it.id) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n >= SHARED_MIN_CITIES).map(([id]) => id));
}

/** H9: growth cut at the top 10% of the pack list. */
export function risingCut(items: Item[]): number {
  const g = items.map((i) => i.growth).filter((x): x is number => typeof x === "number").sort((a, b) => b - a);
  if (!g.length) return Infinity;
  const cut = g[Math.max(0, Math.ceil(g.length * RISING_PCT) - 1)];
  return cut > 0 ? cut : Infinity; // nothing is "rising" if growth is flat
}

export interface ShortlistInput {
  pack: Pack;
  countryPacks: Pack[];
  national: Item[];
  slot: Slot;
  popularityFloor?: number;
}

export interface Shortlist {
  list: ListKey;
  candidates: Pick[];
  roleLoose: boolean;
}

export function shortlist({ pack, countryPacks, national, slot, popularityFloor = POPULARITY_FLOOR }: ShortlistInput): Shortlist {
  const list = listFor(slot);
  const isRestaurant = list === "restaurant";
  let items = (pack.lists[list] ?? []).filter((i) => norm(i.name) !== norm(slot.text) && i.isClosed !== true); // Q1 closed guard
  if (isRestaurant) {
    items = items.filter((i) => !isRestaurantDropped(i)); // AC20
    items = [...items].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || (b.affinity ?? 0) - (a.affinity ?? 0));
    items = items.slice(0, RESTAURANT_TOP); // H10
  }
  const cityRankOf = new Map(items.map((it, i) => [it.id, isRestaurant ? i + 1 : it.rank]));

  const kws = slot.roleKeywords.map((k) => k.toLowerCase()).filter(Boolean);
  let roleLoose = false;
  if (kws.length && !isRestaurant) {
    const matched = items.filter((i) => i.tags.some((t) => kws.some((k) => t.includes(k))));
    if (matched.length) items = matched;
    else roleLoose = true;
  }
  items = items.filter((i) => i.popularity === null || i.popularity >= popularityFloor);

  const shared = isRestaurant ? new Set<string>() : sharedIds(countryPacks, list);
  const rcut = risingCut(pack.lists[list] ?? []);
  const natRank = new Map(national.map((n) => [n.id, n.rank]));
  const topId = (pack.lists[list] ?? [])[0]?.id;
  const origSyl = countSyllables(slot.text);
  const origHard = hardEnding(slot.text);

  const candidates = items.map((it): Pick => {
    const cityRank = cityRankOf.get(it.id)!;
    const isShared = shared.has(it.id);
    const nr = isRestaurant ? null : natRank.get(it.id) ?? 51;
    const lift = isRestaurant || isShared || nr === null ? null : nr - cityRank;
    const postcard = isPostcard(it);
    const rising = typeof it.growth === "number" && it.growth >= rcut;
    const syl = countSyllables(it.name);
    const d = Math.abs(syl - origSyl);
    const s = {
      popularity: it.popularity ?? 0.5,
      lift: lift === null ? 0 : Math.max(0, Math.min(lift, LIFT_CAP)) / LIFT_CAP,
      syllables: d <= 1 ? 1 : d === 2 ? 0.5 : 0,
      stress: slot.isLastWord ? (hardEnding(it.name) === origHard ? 1 : 0) : 1,
      nonCliche: postcard || it.id === topId ? 0 : 1,
      sayable: it.name.split(/\s+/).length <= 3 && it.name.length <= 22 ? 1 : 0,
    };
    const score = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((a, k) => a + WEIGHTS[k] * s[k], 0);
    const country = pack.country;
    const evidence = isRestaurant
      ? `Popular in ${pack.city} (top ${cityRank}).`
      : `#${cityRank} in ${pack.city}, ${nr === 51 ? "outside top 50" : "#" + nr} in ${country}.`;
    const labels: string[] = [];
    if (isShared) labels.push(`Shared pick, popular across ${country}`);
    if (postcard) labels.push("Tourist landmark. Locals may groan.");
    if (rising) labels.push(`Rising fast in ${pack.city}. May date quickly.`);
    return {
      id: it.id, name: it.name, list, category: slot.category, cityRank, nationalRank: nr, lift,
      popularity: it.popularity, syllables: syl, score: Math.round(score * 1000) / 1000,
      shared: isShared, postcard, rising, warning: null, warningReason: null, evidence, labels, tagNames: it.tagNames,
    };
  });
  return { list, candidates: orderPicks(candidates).slice(0, 8), roleLoose };
}

/** Score order, with the H10 rule: within CLOSE_SCORE, brands and TV rank above restaurants. */
export function orderPicks(p: Pick[]): Pick[] {
  return [...p].sort((a, b) => {
    const ar = a.list === "restaurant", br = b.list === "restaurant";
    if (ar !== br && Math.abs(a.score - b.score) <= CLOSE_SCORE) return ar ? 1 : -1;
    return b.score - a.score;
  });
}

export interface Warning { id: string; flag: Flag; reason: string }

/** Apply warnings, take top 3 (local first; shared and postcard only to fill), pre-select best clean pick (D6, D8, H7, H8, H9). */
export function finalize(candidates: Pick[], warnings: Warning[]): { picks: Pick[]; selectedId: string | null; onlyShared: boolean } {
  const w = new Map(warnings.map((x) => [x.id, x]));
  const all = candidates.map((c) => ({ ...c, warning: w.get(c.id)?.flag ?? null, warningReason: w.get(c.id)?.reason ?? null }));
  const local = all.filter((c) => !c.shared && !c.postcard);
  const fill = all.filter((c) => c.shared || c.postcard);
  const picks = orderPicks([...local.slice(0, 3), ...fill.slice(0, Math.max(0, 3 - local.length))]);
  const sel = picks.find((c) => !c.warning && !c.rising && !c.shared && !c.postcard) ?? null;
  return { picks, selectedId: sel?.id ?? null, onlyShared: picks.length > 0 && local.length === 0 };
}
