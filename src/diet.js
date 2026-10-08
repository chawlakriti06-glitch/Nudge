export function dietFor(profile) {
  if (profile.diet) return profile.diet;
  const text = profile.preferences || "";
  if (/non[ -]?(?:vegetarian|veg)\b/i.test(text)) return "non-vegetarian";
  if (/vegan/i.test(text)) return "vegan";
  if (/eggetarian|egg[ -]?eating/i.test(text)) return "eggetarian";
  if (/vegetarian|\bveg\b/i.test(text)) return "vegetarian";
  return "";
}
export function dietConflict(meal, profile) {
  const diet = dietFor(profile);
  const text = [meal.name, meal.portion, ...(meal.ingredients || [])]
    .join(" ")
    .toLowerCase();
  if (
    diet &&
    diet !== "non-vegetarian" &&
    /\b(chicken|beef|pork|fish|salmon|tuna|shrimp|prawns?|meat|mutton|lamb|gelatin|gelatine|anchovies?|oyster sauce|fish sauce|bone broth)\b/.test(
      text,
    )
  )
    return `Contains meat or fish excluded by your ${diet} diet`;
  if (
    ["vegetarian", "vegan"].includes(diet) &&
    /\b(eggs?|mayonnaise)\b/.test(text)
  )
    return "Contains eggs excluded by your diet";
  if (
    diet === "vegan" &&
    /\b(milk|paneer|cheese|yogurt|yoghurt|curd|dahi|butter|ghee|honey|cream|whey)\b/.test(
      text,
    )
  )
    return "Contains dairy or honey excluded by your vegan diet";
  return "";
}
