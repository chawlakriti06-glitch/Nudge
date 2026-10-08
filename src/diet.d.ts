export type Diet =
  | ""
  | "vegetarian"
  | "eggetarian"
  | "vegan"
  | "non-vegetarian";
export function dietFor(profile: { diet?: Diet; preferences?: string }): Diet;
export function dietConflict(
  meal: { name: string; portion: string; ingredients: string[] },
  profile: { diet?: Diet; preferences?: string },
): string;
