export type Category = "dining" | "retail" | "tv" | "restaurant";
export type Country = "United States" | "India";

export const CATEGORY_LABEL: Record<Category, string> = {
  dining: "dining brands",
  retail: "retail brands",
  tv: "TV",
  restaurant: "restaurants",
};

export interface CityDef {
  name: string; // exact Qloo locality query
  country: Country;
  ships: Category[];
  /** substring the Qloo disambiguation must contain (AC19) */
  expect: string;
}

const ALL: Category[] = ["dining", "retail", "tv", "restaurant"];

// Ship matrix, DESIGN.md section 7 (D12, D13, D14)
export const CITIES: CityDef[] = [
  { name: "New York City", country: "United States", ships: ALL, expect: "New York, United States" },
  { name: "Los Angeles", country: "United States", ships: ALL, expect: "California, United States" },
  { name: "Chicago", country: "United States", ships: ALL, expect: "Illinois, United States" },
  { name: "Houston", country: "United States", ships: ALL, expect: "Texas, United States" },
  { name: "Austin", country: "United States", ships: ALL, expect: "Texas, United States" },
  { name: "Atlanta", country: "United States", ships: ALL, expect: "Georgia, United States" },
  { name: "Boston", country: "United States", ships: ALL, expect: "Massachusetts, United States" },
  { name: "Mumbai", country: "India", ships: ["retail"], expect: "India" },
  { name: "Delhi", country: "India", ships: ["retail", "restaurant"], expect: "India" },
  { name: "Bengaluru", country: "India", ships: ["retail"], expect: "India" },
  { name: "Hyderabad", country: "India", ships: ["retail", "tv"], expect: "Telangana, India" },
  { name: "Chennai", country: "India", ships: ["retail", "tv"], expect: "Tamil Nadu, India" },
  { name: "Kolkata", country: "India", ships: ["retail"], expect: "India" },
  { name: "Pune", country: "India", ships: ["retail", "restaurant"], expect: "India" },
];

const ALIASES: Record<string, string> = {
  "new york": "New York City",
  nyc: "New York City",
  "new york, ny": "New York City",
  la: "Los Angeles",
  bangalore: "Bengaluru",
  bombay: "Mumbai",
  "new delhi": "Delhi",
  calcutta: "Kolkata",
  madras: "Chennai",
};

/** Resolve a typed city to a covered city. "New York" is corrected to "New York City" (AC19). */
export function resolveCity(input: string): CityDef | null {
  const k = input.trim().toLowerCase();
  const name = ALIASES[k] ?? input.trim();
  return CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export function shippedNote(c: CityDef): string | null {
  if (c.ships.length === ALL.length) return null;
  const parts = c.ships.map((s) => CATEGORY_LABEL[s]);
  const list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts.at(-1) : parts[0];
  return `${c.name}: ${list} only for now.`;
}

export const slug = (s: string) => s.replace(/\s+/g, "_");
