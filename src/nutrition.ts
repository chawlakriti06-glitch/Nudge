import type { Food } from "./model";
// Standard reference portions, not personalised AI output. Added fats are excluded.
// Generic nutrient values: USDA FoodData Central, https://fdc.nal.usda.gov/.
export function referenceEstimate(
  description: string,
): Omit<Food, "id" | "date"> | null {
  const text = description
    .trim()
    .toLowerCase()
    .replace(/^i (?:ate|had|have eaten)\s+/, "")
    .replace(/[.!]$/, "");
  let match = text.match(
    /^(\d+(?:\.\d+)?)\s*(?:large\s+)?(?:boiled\s+)?eggs?(?:\s*\(boiled\))?$/,
  );
  if (match) {
    const count = Number(match[1]);
    if (count <= 0 || count > 20) return null;
    return {
      name: "Boiled eggs",
      portion: `${count} large eggs (about ${count * 50} g)`,
      calories: Math.round(count * 78),
      protein: Math.round(count * 6.3 * 10) / 10,
      fibre: 0,
      assumptions:
        "Standard reference estimate: assumes large boiled eggs, no oil or butter. USDA FoodData Central generic values; egg size varies.",
    };
  }
  match = text.match(/^(\d+(?:\.\d+)?)\s*(?:plain\s+)?(?:rotis?|chapatis?)$/);
  if (match) {
    const count = Number(match[1]);
    if (count <= 0 || count > 20) return null;
    return {
      name: "Plain whole-wheat roti",
      portion: `${count} medium rotis (30 g dry whole-wheat flour each)`,
      calories: Math.round(count * 102),
      protein: Math.round(count * 4 * 10) / 10,
      fibre: Math.round(count * 3.2 * 10) / 10,
      assumptions:
        "Standard flour reference estimate: assumes whole-wheat roti with water, no oil or ghee. USDA FoodData Central generic flour values; actual roti size varies.",
    };
  }
  match = text.match(
    /^(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:cooked\s+white\s+rice|cooked\s+rice|white\s+rice\s+cooked)$/,
  );
  if (match) {
    const grams = Number(match[1]);
    if (grams <= 0 || grams > 2000) return null;
    return {
      name: "Cooked white rice",
      portion: `${grams} g cooked`,
      calories: Math.round(grams * 1.3),
      protein: Math.round(grams * 0.027 * 10) / 10,
      fibre: Math.round(grams * 0.004 * 10) / 10,
      assumptions:
        "Standard reference estimate: cooked white rice, no added oil. USDA FoodData Central generic values; rice variety varies.",
    };
  }
  return null;
}
