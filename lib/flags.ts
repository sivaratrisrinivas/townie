import type { Flag } from "./types";
// Code-side H4 flag list on names and tags, used alongside the LLM check.
const LIST: [Flag, RegExp][] = [
  ["religion", /\b(temple|mandir|masjid|mosque|church|gurudwara|gurdwara|ganesh|ganpati|krishna|shiva|allah|jesus|christ|bible|quran|halal|kosher|biblical|devotional|bhakti|tirupati|balaji)\b/i],
  ["caste", /\b(brahmin|dalit|reddy|kamma|kapu|iyer|iyengar|jat|rajput|maratha|caste)\b/i],
  ["politics", /\b(bjp|congress|aap|trs|brs|tdp|dmk|aiadmk|shiv sena|modi|gandhi|trump|biden|harris|republican|democrat|maga|politic\w*)\b/i],
];
export function codeFlag(text: string): Flag | null {
  for (const [f, re] of LIST) if (re.test(text)) return f;
  return null;
}
