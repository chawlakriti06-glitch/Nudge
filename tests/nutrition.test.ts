import { test, expect } from "vitest";
import { referenceEstimate } from "../src/nutrition";
test("standard references require quantities and make assumptions visible", () => {
  expect(referenceEstimate("2 eggs")).toMatchObject({
    calories: 156,
    protein: 12.6,
    fibre: 0,
  });
  expect(referenceEstimate("2 eggs")?.assumptions).toContain("boiled");
  expect(referenceEstimate("2 rotis")).toMatchObject({
    calories: 204,
    protein: 8,
    fibre: 6.4,
  });
  expect(referenceEstimate("150 g cooked rice")).toMatchObject({
    calories: 195,
    protein: 4.1,
    fibre: 0.6,
  });
});
test("unknown recipes, missing quantities and added fat go to AI instead of guessed reference values", () => {
  for (const text of [
    "eggs",
    "2 fried eggs",
    "2 eggs and toast",
    "1 katori chana chaat",
    "0 eggs",
    "500 eggs",
  ])
    expect(referenceEstimate(text)).toBeNull();
});
