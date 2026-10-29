import type { Category } from "./cities";
import type { Flag, Item, ListKey, Pack, Pick } from "./types";
import { countSyllables, hardEnding } from "./syllables";
import { itemSubs, NEAR, slotSub, type Sub } from "./subcat";

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

export function listFor(slot: { category: Category; roleKeywords: string[]; text?: string; role?: string }): ListKey {
  const sub = slot.category === "retail" ? slotSub({ text: slot.text ?? "", role: slot.role ?? "", roleKeywords: slot.roleKeywords }) : null;
  if (sub === "bigbox" || sub === "pharmacy") return "retail"; // TN-FIX3: Costco is a big box, not a grocer
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

/** TN-FIX3: say a Qloo name the way people do ("Chuy's Restaurant" -> "Chuy's", "99 Cents Only Stores" -> "99 Cents Only"). */
export function spoken(name: string): string {
  const t = name.replace(/\s+(Restaurants?|Stores?|Supermarkets?)$/i, "");
  return t.trim().length >= 3 ? t : name;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
/** TN-FIX3: drop items Qloo itself places in some other city (Eggslut is an LA spot, not an NYC one). */
export function isOutOfTown(it: Item, city: string, locality: string | null | undefined): boolean {
  const homes = it.tags.map((t) => /restaurants_in_(.+)$/.exec(t)?.[1]).filter((x): x is string => !!x);
  if (!homes.length) return false;
  const here = [slugify(city), ...(locality ?? "").split(",").map((x) => slugify(x.trim())).filter((x) => x && x !== "united_states")];
  if (city === "New York City") here.push("new_york");
  return !homes.some((h) => here.some((x) => h.includes(x)));
}

/** TN-FIX3: keep only candidates that do the same job as the original. Exact sub first, then a near one. */
export function fitSub(items: Item[], sub: Sub | null): { items: Item[]; fit: "exact" | "near" | "none" | "any" } {
  if (!sub) return { items, fit: "any" };
  // A delivery app stands in for "food I didn't cook": any savory takeout, not a cupcake or a latte.
  if (sub === "delivery") return { items: items.filter((i) => { const s = itemSubs(i); return !s.has("sweets") && !s.has("coffee"); }), fit: "any" };
  const exact = items.filter((i) => itemSubs(i).has(sub));
  if (exact.length) return { items: exact, fit: "exact" };
  const near = NEAR[sub] ?? [];
  const n = items.filter((i) => near.some((x) => itemSubs(i).has(x)));
  if (n.length) return { items: n, fit: "near" };
  return { items: [], fit: "none" };
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
  const sub = isRestaurant || ["tv", "music", "celeb"].includes(slot.category) ? null : slotSub(slot);
  let pool = pack.lists[list] ?? [];
  // A big box or pharmacy can also be found on the city's grocery list (superstores, discount grocers).
  if (sub === "bigbox" || sub === "pharmacy") pool = [...pool, ...(pack.lists.grocery ?? []).filter((g) => !pool.some((x) => x.id === g.id))];
  // Qloo's own sub-category list for this city (for example pizza chains in Los Angeles).
  const mainIds = new Set(pool.map((x) => x.id));
  if (sub && pack.subs?.[sub]?.length) pool = [...pool, ...pack.subs[sub]!.filter((g) => !pool.some((x) => x.id === g.id))];
  let items = pool.filter((i) => norm(i.name) !== norm(slot.text) && i.isClosed !== true); // Q1 closed guard
  items = items.filter((i) => !isOutOfTown(i, pack.city, pack.localities[list]));
  if (isRestaurant) {
    items = items.filter((i) => !isRestaurantDropped(i)); // AC20
    items = [...items].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || (b.affinity ?? 0) - (a.affinity ?? 0));
    items = items.slice(0, RESTAURANT_TOP); // H10
  }
  const cityRankOf = new Map(items.map((it, i) => [it.id, isRestaurant ? i + 1 : it.rank]));

  const kws = slot.roleKeywords.map((k) => k.toLowerCase()).filter(Boolean);
  let roleLoose = false;
  if (sub) {
    const f = fitSub(items, sub);
    items = f.items;
    roleLoose = f.fit === "near";
  } else if (kws.length && !isRestaurant) {
    const matched = items.filter((i) => i.tags.some((t) => kws.some((k) => t.includes(k))));
    if (matched.length) items = matched;
    else roleLoose = true;
  }
  const above = (xs: Item[], f: number) => xs.filter((i) => i.popularity === null || i.popularity >= f);
  // TN-FIX3: a right-kind local pick a little under the floor beats a wrong-kind one (Chuy's for Chipotle in Austin).
  if (sub && !above(items, popularityFloor).length && !roleLoose) items = above(items, popularityFloor - 0.2);
  else items = above(items, popularityFloor);

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
    const subOnly = !mainIds.has(it.id); // ranked inside Qloo's sub-category list, so no fair lift
    const lift = isRestaurant || isShared || nr === null || subOnly ? null : nr - cityRank;
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
      : subOnly ? `#${cityRank} of its kind in ${pack.city} on Qloo.`
      : `#${cityRank} in ${pack.city}, ${nr === 51 ? "outside top 50" : "#" + nr} in ${country}.`;
    const labels: string[] = [];
    if (isShared) labels.push(`Shared pick, popular across ${country}`);
    if (postcard) labels.push("Tourist landmark. Locals may groan.");
    if (rising) labels.push(`Rising fast in ${pack.city}. May date quickly.`);
    return {
      id: it.id, name: spoken(it.name), list, category: slot.category, cityRank, nationalRank: nr, lift,
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
