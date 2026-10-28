// Sub-category fit (TN-FIX3). A swap must do the same job in the joke as the original:
// pizza stays pizza, coffee stays coffee, a sit-down chain stays a sit-down place.
// This only classifies; every candidate still comes from the Qloo packs.
import type { Item } from "./types";

export type Sub =
  | "pizza" | "coffee" | "burger" | "mexican" | "chicken" | "sandwich" | "sweets" | "salad" | "sitdown"
  | "bigbox" | "pharmacy" | "fashion" | "home" | "grocery" | "delivery";

// Tag/name patterns for Qloo items. Order matters only for readability; an item can have several subs.
const ITEM: [Sub, RegExp][] = [
  ["pizza", /pizza/],
  ["coffee", /coffee|espresso|cafes?(_|\s|$)|coffeehouse|_tea\b|:tea$|matcha|juice/],
  ["burger", /hamburger|burger|frozen_custard/],
  ["mexican", /mexican|tex_mex|taco|burrito/],
  ["chicken", /chicken|wings/],
  ["sandwich", /sandwich|submarine|delicatessen|(^|_|\s)delis?(_|\s|$)|bagel/],
  ["sweets", /baker(y|ies)|cake|cookie|dessert|doughnut|donut|ice_cream|cupcake|confection|candy|custard|pastr/],
  ["salad", /salad|fast_casual|vegan|vegetarian|plant_based|health_food/],
  ["sitdown", /steakhouse|grill|bar_and_grill|casual_dining|seafood_restaurants|barbecue|bbq|brewpub|brewery|diner|drive_in|family_restaurant|sports_bar|darden|bloomin_brands|roadhouse/],
  ["bigbox", /discount_stores|superstores|hypermarket|warehouse_club|department_stores_of_the_united_states|variety_stores|dollar_store/],
  ["pharmacy", /pharmac|drugstore|convenience_store/],
  ["fashion", /apparel|fashion|clothing|footwear|handbags|dresses|jewelry/],
  ["home", /home_decor|furniture|housewares|kitchenware/],
  ["grocery", /supermarket|grocer|health_food_stores/],
];

/** Which subs a Qloo item fits, from its tags and name. */
export function itemSubs(it: Pick<Item, "name" | "tags">): Set<Sub> {
  const hay = (it.tags.join(" ") + " " + it.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")).toLowerCase();
  const subs = new Set(ITEM.filter(([, re]) => re.test(hay)).map(([s]) => s));
  // A "grill" that is really a burger or veggie counter is not a sit-down rib place.
  if (subs.has("sitdown") && (subs.has("burger") || subs.has("salad") || /vegg|vegan/.test(hay)) && !/steakhouse|barbecue|bbq|seafood/.test(hay)) subs.delete("sitdown");
  return subs;
}

// What the ORIGINAL reference is. Common chains comics name, then the role words from the noun finder.
const KNOWN: [RegExp, Sub][] = [
  [/domino|pizza hut|papa john|little caesar|sbarro|pizza/i, "pizza"],
  [/starbucks|dunkin|tim horton|peet|caribou|coffee|caf[eé]/i, "coffee"],
  [/mcdonald|burger king|wendy|five guys|whataburger|in-n-out|jack in the box|sonic|white castle|burger/i, "burger"],
  [/chipotle|taco bell|qdoba|del taco|moe'?s|taco|burrito/i, "mexican"],
  [/kfc|popeyes|chick-fil-a|raising cane|wingstop|church'?s/i, "chicken"],
  [/subway|jimmy john|jersey mike|quiznos|panera|potbelly/i, "sandwich"],
  [/krispy kreme|cinnabon|baskin|dairy queen|cold stone|cheesecake|crumbl/i, "sweets"],
  [/sweetgreen|chopt|salad/i, "salad"],
  [/applebee|chili'?s|olive garden|tgi friday|red lobster|outback|texas roadhouse|denny|ihop|buffalo wild|red robin|cracker barrel|ruby tuesday|hooters|longhorn/i, "sitdown"],
  [/costco|sam'?s club|bj'?s wholesale|walmart|target|kmart|big lots|dollar (tree|general)|marshalls|tj ?maxx|ross/i, "bigbox"],
  [/duane reade|cvs|walgreens|rite aid|7-eleven/i, "pharmacy"],
  [/seamless|doordash|grubhub|uber ?eats|postmates|instacart/i, "delivery"],
];
const ROLE: [RegExp, Sub][] = [
  [/pizza/i, "pizza"], [/coffee|cafe|latte/i, "coffee"], [/burger/i, "burger"], [/mexican|taco|burrito/i, "mexican"],
  [/chicken|wing/i, "chicken"], [/sandwich|sub shop|deli/i, "sandwich"], [/bakery|dessert|donut|ice cream|cake/i, "sweets"],
  [/salad|healthy/i, "salad"], [/sit[- ]down|casual dining|family restaurant|steakhouse|bar and grill|chain restaurant|rib|barbecue/i, "sitdown"],
  [/big[- ]box|warehouse|bulk|discount|department store|superstore/i, "bigbox"], [/pharmacy|drugstore|convenience/i, "pharmacy"],
  [/delivery|takeout app|food app/i, "delivery"],
];

export function slotSub(slot: { text: string; role: string; roleKeywords: string[] }): Sub | null {
  for (const [re, s] of KNOWN) if (re.test(slot.text)) return s;
  const words = slot.role + " " + slot.roleKeywords.join(" ").replace(/_/g, " ");
  for (const [re, s] of ROLE) if (re.test(words)) return s;
  return null;
}

/** Subs that still do the same comic job when no exact match exists. Delivery apps fit any takeout place. */
export const NEAR: Partial<Record<Sub, Sub[]>> = {
  sitdown: ["burger"],
  burger: ["chicken", "sandwich"],
  chicken: ["burger"],
  sandwich: ["salad", "burger"],
  salad: ["sandwich"],
  mexican: [],
  pizza: [],
  coffee: ["sweets"],
  bigbox: ["grocery"],
  pharmacy: ["grocery", "bigbox"],
};
