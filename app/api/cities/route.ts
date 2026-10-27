import { CITIES, shippedNote } from "@/lib/cities";
import { json } from "@/lib/api";
export async function GET() {
  return json(CITIES.map((c) => ({ name: c.name, country: c.country, note: shippedNote(c) })));
}
