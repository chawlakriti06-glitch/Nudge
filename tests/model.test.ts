import { describe, it, expect } from "vitest";
import {
  dateKey,
  totals,
  estimate,
  slots,
  validateResponse,
  conflict,
  type Profile,
  days,
} from "../src/model";
const p: Profile = {
  name: "Kriti",
  height: 165,
  weight: 62,
  activity: "Medium",
  goal: "Maintain",
  meals: 3,
  preferences: "Vegetarian",
  dislikes: "mushroom",
  allergies: "milk, peanut",
  language: "English",
  budget: 1800,
  cycle: false,
};
const menu = (count: number) =>
  days.map((day) => ({
    day,
    meals: slots(count).map((slot) => ({
      slot,
      name: "Lentil rice bowl",
      portion: "100 g cooked rice, 150 g cooked lentils",
      ingredients: ["rice", "lentils", "olive oil"],
      calories: 450,
      assumptions: "1 tsp oil included",
      approved: false,
    })),
  }));
describe("Nudge invariants", () => {
  it("separates dates and totals without hiding over-budget intake", () => {
    const foods = [
      {
        id: "1",
        date: "2026-10-07",
        name: "meal",
        portion: "1",
        calories: 1900,
        assumptions: "estimate",
      },
      {
        id: "2",
        date: "2026-10-08",
        name: "meal",
        portion: "1",
        calories: 300,
        assumptions: "estimate",
      },
    ];
    expect(totals(foods, 1800, "2026-10-07")).toEqual({
      eaten: 1900,
      remaining: -100,
    });
    expect(
      totals(
        foods.filter((f) => f.id !== "1"),
        1800,
        "2026-10-07",
      ).eaten,
    ).toBe(0);
    expect(dateKey(new Date(2026, 9, 8))).toBe("2026-10-08");
  });
  it("calculates adult Mifflin equation and refuses minors", () => {
    expect(estimate(62, 165, 30, "female", "Medium")).toBe(2077);
    expect(estimate(62, 165, 30, "male", "Low")).toBe(1808);
    expect(() => estimate(62, 165, 17, "female", "Medium")).toThrow();
  });
  it.each([3, 4])("requires all seven days and exactly %i slots", (count) => {
    const r = { message: "Draft", kind: "plan", foods: [], days: menu(count) };
    expect(
      validateResponse(r, { ...p, meals: count as 3 | 4 }).days,
    ).toHaveLength(7);
    r.days[0].meals.pop();
    expect(() =>
      validateResponse(r, { ...p, meals: count as 3 | 4 }),
    ).toThrow();
  });
  it("rejects hidden dairy and preferences conflicts", () => {
    expect(
      conflict({ name: "Rice", portion: "1 bowl", ingredients: ["ghee"] }, p),
    ).toContain("milk");
    expect(
      conflict(
        { name: "Chicken", portion: "150 g cooked", ingredients: ["chicken"] },
        p,
      ),
    ).toContain("vegetarian");
    const r = { message: "Draft", kind: "plan", foods: [], days: menu(3) };
    r.days[0].meals[0].ingredients.push("peanut oil");
    expect(() => validateResponse(r, p)).toThrow();
  });
  it("rejects malformed nutrition rather than applying partial output", () => {
    expect(() =>
      validateResponse(
        {
          message: "x",
          kind: "log",
          foods: [{ name: "x", portion: "1", calories: -1, assumptions: "x" }],
          days: [],
        },
        p,
      ),
    ).toThrow();
    expect(() =>
      validateResponse(
        { message: "x", kind: "plan", foods: [], days: menu(3).slice(0, 6) },
        p,
      ),
    ).toThrow();
  });
});

it("distinguishes Indian vegetarian, eggetarian, vegan and non-vegetarian diets", () => {
  const meal = (name: string) => ({
    name,
    portion: "1 bowl",
    ingredients: [name],
  });
  const base = { ...p, allergies: "None", dislikes: "" };
  expect(
    conflict(meal("Chicken stock"), { ...base, diet: "vegetarian" }),
  ).toContain("vegetarian");
  expect(
    conflict(meal("Egg curry"), { ...base, diet: "vegetarian" }),
  ).toContain("eggs");
  expect(conflict(meal("Egg curry"), { ...base, diet: "eggetarian" })).toBe("");
  expect(conflict(meal("Paneer"), { ...base, diet: "vegan" })).toContain(
    "vegan",
  );
  expect(
    conflict(meal("Rajma and roti"), { ...base, diet: "vegetarian" }),
  ).toBe("");
  expect(
    conflict(meal("Chicken"), { ...base, preferences: "Non-vegetarian" }),
  ).toBe("");
});
it("rejects generic meal labels as confirmable food previews", () => {
  expect(() =>
    validateResponse(
      {
        kind: "log",
        message: "Preview",
        days: [],
        foods: [
          {
            name: "Breakfast",
            portion: "Breakfast",
            assumptions: "Breakfast",
            calories: 250,
          },
        ],
      },
      p,
    ),
  ).toThrow("actual food or portion");
});
