import { dietConflict, type Diet } from "./diet.js";
export type Profile = {
  name: string;
  height: number;
  weight: number;
  activity: string;
  goal: string;
  meals: 3 | 4;
  preferences: string;
  diet?: Diet;
  dislikes: string;
  allergies: string;
  language: string;
  budget: number;
  cycle: boolean;
  proteinTarget?: number;
  fibreTarget?: number;
};
export type Food = {
  id: string;
  date: string;
  name: string;
  portion: string;
  calories: number;
  protein?: number | null;
  fibre?: number | null;
  assumptions: string;
};
export type Meal = {
  slot: string;
  name: string;
  portion: string;
  ingredients: string[];
  calories: number;
  protein?: number | null;
  fibre?: number | null;
  assumptions: string;
  approved: boolean;
};
export type Day = { day: string; meals: Meal[] };
export type Proposal = {
  kind: "log" | "plan" | "adjustment";
  date?: string;
  fromCraving?: boolean;
  logDate?: string;
  editId?: string;
  sourceLabel?: string;
  basis?: { intake: string; meal: string };
  adjustments?: { day: string; meal: Meal }[];
  foods: Omit<Food, "id" | "date">[];
  days: Day[];
};
export type Chat = { id: string; role: "user" | "assistant"; text: string };
export type State = {
  profile: Profile | null;
  foods: Food[];
  chat: Chat[];
  plan: Day[];
  draft: Day[];
  steps: Record<string, number>;
  paused: string;
  pending: string;
  proposal?: Proposal | null;
};
export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const slots = (count: number) =>
  count === 4
    ? ["Breakfast", "Lunch", "Snacks", "Dinner"]
    : ["Breakfast", "Lunch", "Dinner"];
export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const emptyState = (): State => ({
  profile: null,
  foods: [],
  chat: [],
  plan: [],
  draft: [],
  steps: {},
  paused: "",
  pending: "",
});
export function totals(foods: Food[], budget: number, date = dateKey()) {
  const eaten = foods
    .filter((f) => f.date === date)
    .reduce((s, f) => s + f.calories, 0);
  const today = foods.filter((f) => f.date === date);
  const nutrient = (key: "protein" | "fibre") => ({
    value: today.reduce(
      (sum, f) => sum + (typeof f[key] === "number" ? f[key]! : 0),
      0,
    ),
    unknown: today.filter((f) => typeof f[key] !== "number").length,
  });
  return {
    eaten,
    remaining: budget - eaten,
    protein: nutrient("protein"),
    fibre: nutrient("fibre"),
  };
}
export function estimate(
  weight: number,
  height: number,
  age: number,
  sex: string,
  activity: string,
) {
  if (
    age < 18 ||
    age > 100 ||
    weight < 30 ||
    weight > 300 ||
    height < 120 ||
    height > 230 ||
    !["female", "male"].includes(sex)
  )
    throw Error(
      "Adult estimation requires valid age, height, weight and sex inputs.",
    );
  const factor: Record<string, number> = {
    Low: 1.2,
    Medium: 1.55,
    High: 1.725,
  };
  return Math.round(
    (10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161)) *
      (factor[activity] || 1.2),
  );
}
const aliases: Record<string, string[]> = {
  milk: [
    "milk",
    "cream",
    "butter",
    "cheese",
    "paneer",
    "yogurt",
    "curd",
    "ghee",
    "whey",
  ],
  dairy: [
    "milk",
    "cream",
    "butter",
    "cheese",
    "paneer",
    "yogurt",
    "curd",
    "ghee",
    "whey",
  ],
  nuts: [
    "almond",
    "cashew",
    "walnut",
    "pistachio",
    "hazelnut",
    "peanut",
    "nut",
  ],
  peanut: ["peanut", "groundnut"],
  gluten: ["wheat", "bread", "roti", "pasta", "semolina", "flour", "barley"],
  egg: ["egg", "mayonnaise"],
  soy: ["soy", "tofu"],
  fish: ["fish", "salmon", "tuna", "cod"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "shellfish"],
  sesame: ["sesame", "tahini"],
};
export function conflict(
  meal: Pick<Meal, "name" | "ingredients" | "portion">,
  p: Profile,
) {
  const text = [meal.name, meal.portion, ...meal.ingredients]
    .join(" ")
    .toLowerCase();
  const restrictions = [
    ...p.allergies.split(/[,;\n]/),
    ...p.dislikes.split(/[,;\n]/),
  ]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== "none");
  for (const r of restrictions) {
    const key = Object.keys(aliases).find((k) => r.includes(k));
    if ((key ? aliases[key] : [r]).some((a) => text.includes(a)))
      return `Conflicts with ${r}`;
  }
  return dietConflict(meal, p);
}
export function validateResponse(raw: unknown, p: Profile) {
  if (!raw || typeof raw !== "object")
    throw Error("AI returned an invalid response.");
  const r = raw as {
    message: unknown;
    kind: unknown;
    foods: unknown;
    days: unknown;
    adjustments?: unknown;
  };
  if (
    typeof r.message !== "string" ||
    r.message.length > 6000 ||
    !["message", "log", "plan", "adjustment"].includes(String(r.kind)) ||
    !Array.isArray(r.foods) ||
    !Array.isArray(r.days)
  )
    throw Error("AI returned an invalid response.");
  const number = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 10000;
  for (const f of r.foods)
    if (
      typeof f.name !== "string" ||
      typeof f.portion !== "string" ||
      typeof f.assumptions !== "string" ||
      !number(f.calories) ||
      (f.protein != null && !number(f.protein)) ||
      (f.fibre != null && !number(f.fibre))
    )
      throw Error("Invalid food estimate.");
  if (
    (r.kind === "log" || r.kind === "adjustment") &&
    r.foods.some(
      (f) =>
        !f.name.trim() ||
        !f.portion.trim() ||
        !f.assumptions.trim() ||
        /^(breakfast|lunch|dinner|snacks?|meal)[.!]?$/i.test(f.name.trim()) ||
        /^(breakfast|lunch|dinner|snacks?|meal)[.!]?$/i.test(f.portion.trim()),
    )
  )
    throw Error(
      "The food preview is missing actual food or portion details. Please retry or correct it manually.",
    );
  if (r.kind === "log" && !r.foods.length)
    throw Error("Food preview is empty.");
  if (r.kind === "adjustment") {
    if (
      !Array.isArray(r.adjustments) ||
      r.adjustments.length !== 1 ||
      !r.foods.length
    )
      throw Error(
        "A meal adjustment must include one replacement and the food you are considering.",
      );
    const a = r.adjustments[0];
    const m = a.meal;
    if (
      !days.includes(a.day) ||
      !m ||
      !slots(p.meals).includes(m.slot) ||
      typeof m.name !== "string" ||
      !m.name.trim() ||
      typeof m.portion !== "string" ||
      !m.portion.trim() ||
      !Array.isArray(m.ingredients) ||
      !m.ingredients.length ||
      !m.ingredients.every((i: unknown) => typeof i === "string") ||
      !number(m.calories) ||
      typeof m.assumptions !== "string" ||
      (m.protein != null && !number(m.protein)) ||
      (m.fibre != null && !number(m.fibre))
    )
      throw Error("The proposed meal is incomplete. Your plan is unchanged.");
    const error = conflict(m, p);
    if (error) throw Error(`${error}. Your plan is unchanged.`);
  }
  if (r.kind === "plan") {
    if (r.days.length !== 7 || new Set(r.days.map((d) => d.day)).size !== 7)
      throw Error("A complete seven-day menu is required.");
    for (const d of r.days) {
      if (
        !days.includes(d.day) ||
        !Array.isArray(d.meals) ||
        d.meals.length !== p.meals
      )
        throw Error("Incorrect menu meal count.");
      for (const [i, m] of d.meals.entries()) {
        if (
          m.slot !== slots(p.meals)[i] ||
          typeof m.name !== "string" ||
          typeof m.portion !== "string" ||
          typeof m.assumptions !== "string" ||
          !Array.isArray(m.ingredients) ||
          !m.ingredients.length ||
          !m.ingredients.every((x: unknown) => typeof x === "string") ||
          !number(m.calories) ||
          (m.protein != null && !number(m.protein)) ||
          (m.fibre != null && !number(m.fibre))
        )
          throw Error("Invalid meal details.");
        const error = conflict(m, p);
        if (error) throw Error(`${error}. Menu was not applied.`);
      }
    }
  }
  return {
    message: r.message,
    kind: r.kind as "message" | "log" | "plan" | "adjustment",
    adjustments: (r.adjustments || []) as NonNullable<Proposal["adjustments"]>,
    foods: r.foods as Proposal["foods"],
    days: days
      .filter((day) => (r.days as Day[]).some((d) => d.day === day))
      .map((day) => (r.days as Day[]).find((d) => d.day === day)!),
  };
}
