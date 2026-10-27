export type CityName = { name: string };
// Client-side coverage check. "loading" until the covered list arrives, so a fast entry can't slip past it.
// If the list failed to load (null-free empty list after load), we let the server decide; it rejects uncovered cities.
export function cityStatus(input: string, cities: CityName[], loaded: boolean): "empty" | "loading" | "unknown" | "ok" {
  const q = input.trim().toLowerCase();
  if (q.length === 0) return "empty";
  if (!loaded) return "loading";
  if (cities.length === 0) return "ok";
  if (cities.some((c) => c.name.toLowerCase() === q)) return "ok";
  if (q.length > 1 && !cities.some((c) => c.name.toLowerCase().startsWith(q))) return "unknown";
  return "ok";
}
