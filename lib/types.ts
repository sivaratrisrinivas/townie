import type { Category, Country } from "./cities";

export interface Item {
  id: string;
  name: string;
  rank: number;
  popularity: number | null;
  affinity: number | null;
  growth: number | null;
  tags: string[];
  tagNames: string[];
  priceLevel: number | null;
  isClosed: boolean | null;
  city: string | null;
}

export type ListKey = "dining" | "retail" | "grocery" | "tv" | "restaurant" | "music" | "celeb";

export interface Pack {
  city: string;
  country: Country;
  lists: Partial<Record<ListKey, Item[]>>;
  localities: Partial<Record<ListKey, string | null>>;
  /** TN-FIX3: Qloo lists for one sub-category in this city (pizza, coffee, ...). */
  subs?: Partial<Record<string, Item[]>>;
}

export type Flag = "religion" | "caste" | "politics";

export interface Pick {
  id: string;
  name: string;
  list: ListKey;
  category: Category;
  cityRank: number;
  nationalRank: number | null; // 51 = outside national top 50; null for restaurants
  lift: number | null; // null for restaurants and shared items
  popularity: number | null;
  syllables: number;
  score: number;
  shared: boolean;
  postcard: boolean;
  rising: boolean;
  warning: Flag | null;
  warningReason: string | null;
  evidence: string;
  labels: string[];
  tagNames: string[];
}
