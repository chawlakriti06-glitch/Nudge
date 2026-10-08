import { test, expect, type Page } from "@playwright/test";
// @ts-expect-error standalone server module
import { handleApi } from "../server/api.mjs";
const profile = {
  name: "Kriti",
  height: 165,
  weight: 62,
  activity: "Medium",
  goal: "Maintain",
  meals: 3,
  preferences: "Vegetarian",
  dislikes: "",
  allergies: "peanut",
  language: "English",
  budget: 1800,
  cycle: false,
};
const seed = async (page: Page) => {
  await page.addInitScript((p) => {
    if (!localStorage.getItem("nudge.local.v1"))
      localStorage.setItem(
        "nudge.local.v1",
        JSON.stringify({
          profile: p,
          foods: [],
          chat: [],
          plan: [],
          draft: [],
          steps: {},
          paused: "",
          pending: "",
        }),
      );
  }, profile);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
};
async function assertHomeIntake(
  page: Page,
  label: string,
  attribute: string,
  value: string,
  arc = false,
) {
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Home", exact: true }).click();
  const indicator = page.getByRole("progressbar", { name: label });
  await expect(
    arc ? indicator.locator(".calorie-progress") : indicator,
  ).toHaveAttribute(attribute, value);
  await nav.getByRole("button", { name: "Log food", exact: true }).click();
}
async function nutritionOverride(page: Page) {
  if (
    !(await page.getByLabel("Estimated calories", { exact: true }).isVisible())
  )
    await page.getByText("Enter nutrition myself", { exact: true }).click();
}
test("manual onboarding retains welcome food, confirms once, reloads, edits and deletes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s get started" }).click();
  await page.getByLabel("Message", { exact: true }).fill("I ate 2 samosas");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: "No known allergies — None" }).click();
  await page
    .getByText("Add a calorie target (optional)", { exact: true })
    .click();
  await page
    .getByLabel("Dietary preference", { exact: true })
    .selectOption("vegetarian");
  await page.getByLabel("Daily calorie budget (kcal)").fill("1800");
  await page
    .getByRole("button", { name: "Start using Nudge", exact: true })
    .click();
  await expect(
    page.getByText("I ate 2 samosas", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Portion", { exact: true }).fill("2 medium samosas");
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Confirm & log" }).click();
  await expect(
    page.getByText("1,300 kcal remaining", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(
    page.getByText("1,300 kcal remaining", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("450");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("1,350 kcal remaining", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByText("1,800 kcal remaining", { exact: true }),
  ).toBeVisible();
});
test("adult estimate path shows assumptions and needs acceptance", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s get started" }).click();
  await page.getByRole("button", { name: "Set up my menu first" }).click();
  await page
    .getByRole("button", { name: "Set up with measurements instead" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Help me estimate" }).click();
  await page.getByLabel("Age", { exact: true }).fill("30");
  await page.getByLabel("Sex for calorie estimate").selectOption("female");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(
    page.getByText("Estimated maintenance: 2,077 kcal/day"),
  ).toBeVisible();
  await expect(page.getByLabel("Daily calorie budget (kcal)")).toHaveValue("");
  await page.getByRole("button", { name: "Use maintenance budget" }).click();
  await expect(page.getByLabel("Daily calorie budget (kcal)")).toHaveValue(
    "2077",
  );
});
test("AI unavailable preserves data and intentions do not log", async ({
  page,
}) => {
  await seed(page);
  await page.route("**/api/chat", (r) =>
    r.fulfill({ status: 503, json: { error: "AI unavailable test" } }),
  );
  await page.getByLabel("Message", { exact: true }).fill("I want 2 samosas");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText("AI unavailable");
  await expect(
    page.getByText("1,800 kcal remaining", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".bubble.user")).toContainText("I want 2 samosas");
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.locator(".bubble.user")).toContainText("I want 2 samosas");
});
test("pause allows logging, resume and delete clear only Nudge", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() =>
    localStorage.setItem("trace.prototype.v1", "preserve"),
  );
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("switch", { name: "Pause suggestions today" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(
    page.getByText("Suggestions paused today.", { exact: false }),
  ).toBeVisible();
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("Toast");
  await page.getByLabel("Portion", { exact: true }).fill("1 bread slice");
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("80");
  await page.getByRole("button", { name: "Confirm & log" }).click();
  await expect(page.getByText("1,720 kcal remaining")).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByText("Suggestions paused today.", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete my data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete my data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Let’s get started" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("trace.prototype.v1")),
  ).toBe("preserve");
});
test("explicit AI fixture exercises menu approvals and allergy rejection, not a live provider", async ({
  page,
}) => {
  await seed(page);
  const menu = Array.from(
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    (day) => ({
      day,
      meals: ["Breakfast", "Lunch", "Dinner"].map((slot) => ({
        slot,
        name: "Rice and dal",
        portion: "100 g cooked rice, 150 g cooked dal",
        ingredients: ["rice", "lentils", "olive oil"],
        calories: 500,
        assumptions: "1 tsp oil included",
      })),
    }),
  );
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: { message: "Menu fixture", kind: "plan", foods: [], days: menu },
    }),
  );
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Create my weekly draft" }).click();
  await expect(
    page.getByRole("button", { name: "Review draft", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Draft for review.", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".notice[tabindex='-1']")
        .evaluate((el) => document.activeElement === el),
    )
    .toBe(true);
  await expect(page.locator(".meal")).toHaveCount(3);
  await page.getByRole("button", { name: "Approve & save full week" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page
    .getByRole("combobox", { name: "Meals per day", exact: true })
    .selectOption("4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const four = menu.map((d) => ({
    ...d,
    meals: [
      ...d.meals.slice(0, 2),
      { ...d.meals[0], slot: "Snacks" },
      d.meals[2],
    ],
  }));
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: { message: "4 slot fixture", kind: "plan", foods: [], days: four },
    }),
  );
  await page.getByRole("button", { name: "Create revised draft" }).click();
  await expect(
    page.getByRole("button", { name: "Review draft", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Draft for review.", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".notice[tabindex='-1']")
        .evaluate((el) => document.activeElement === el),
    )
    .toBe(true);
  await expect(page.locator(".meal")).toHaveCount(4);
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.locator(".meal")).toHaveCount(3);
  four[0].meals[0].ingredients = ["peanut"];
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: { message: "unsafe fixture", kind: "plan", foods: [], days: four },
    }),
  );
  await page.getByRole("button", { name: "Create revised draft" }).click();
  await expect(page.getByRole("alert")).toContainText("Conflicts with peanut");
});
test("phone screens have no horizontal clipping or food photos", async ({
  page,
}) => {
  await seed(page);
  for (const tab of ["Home", "Log food", "Menu", "Profile"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("img")).toHaveCount(0);
    await page.screenshot({
      path: `/tmp/nudge-${tab.toLowerCase()}.png`,
      fullPage: true,
    });
  }
});
test("confirmed AI preview is durable and applies once", async ({ page }) => {
  await seed(page);
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: {
        message: "Preview test fixture",
        kind: "log",
        foods: [
          {
            name: "Samosas",
            portion: "2 medium, fried",
            calories: 500,
            assumptions: "Fixture only; not live AI",
          },
        ],
        days: [],
      },
    }),
  );
  await page.getByLabel("Message", { exact: true }).fill("I ate 2 samosas");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Here’s the estimate. Shall I add it?"),
  ).toBeVisible();
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(
    page.getByText("Here’s the estimate. Shall I add it?"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await expect(page.getByText("1,300 kcal remaining")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm & log", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.getByText("1,300 kcal remaining")).toBeVisible();
});
test("different days, nutrient totals and undo recalculate independently", async ({
  page,
}) => {
  await seed(page);
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("Rice");
  await page.getByLabel("Portion", { exact: true }).fill("100 g cooked");
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("130");
  await page.getByLabel("Date", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Confirm & log" }).click();
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByLabel("Ledger date").fill("2026-01-01");
  await expect(page.getByText("130 kcal eaten · estimated")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await assertHomeIntake(page, "Daily protein intake", "aria-valuenow", "0");
  await assertHomeIntake(page, "Daily fibre intake", "aria-valuenow", "0");
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByLabel("Ledger date").fill("2026-01-01");
  await expect(page.getByText("Nothing logged for this day.")).toBeVisible();
});
test("explicit pause phrase is a local control, not a fake AI reply", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Message", { exact: true }).fill("I don’t care today");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Suggestions paused today.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".bubble.user")).toContainText(
    "I don’t care today",
  );
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
});

test("measurements can be cleared and retyped without forced zero", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s get started" }).click();
  await page.getByRole("button", { name: "Set up my menu first" }).click();
  await page
    .getByRole("button", { name: "Set up with measurements instead" })
    .click();
  for (const [label, value] of [
    ["Height (cm)", "170"],
    ["Weight (kg)", "65.5"],
  ]) {
    const input = page.getByLabel(label, { exact: true });
    await input.fill("");
    await expect(input).toHaveValue("");
    await input.fill("0");
    await input.press("Backspace");
    await expect(input).toHaveValue("");
    await input.fill(value);
    await expect(input).toHaveValue(value);
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Help me estimate" }).click();
  await expect(
    page.getByRole("combobox", { name: "Sex for calorie estimate" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Female", exact: true }),
  ).toHaveCount(1);
});
test("deployed HTML API fallback explains setup and preserves saved intake", async ({
  page,
}) => {
  await seed(page);
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!DOCTYPE html><html>SPA fallback</html>",
    }),
  );
  await page.getByLabel("Message", { exact: true }).fill("I want 2 samosas");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "AI endpoint is unavailable",
  );
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
});
test("calorie arc follows confirmed food, edits, delete and undo", async ({
  page,
}) => {
  await seed(page);
  const ring = page.getByRole("progressbar", { name: "Daily calorie intake" });
  const arc = ring.locator(".calorie-progress");
  await assertHomeIntake(page, "Daily calorie intake", "aria-valuenow", "0");
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "stroke-dashoffset",
    "100",
    true,
  );
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("Lunch");
  await page.getByLabel("Portion", { exact: true }).fill("1 plate");
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("900");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods,
    ),
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await assertHomeIntake(page, "Daily calorie intake", "aria-valuenow", "50");
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "stroke-dashoffset",
    "50",
    true,
  );
  await expect(
    page.getByText("900 kcal remaining", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("450");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await assertHomeIntake(page, "Daily calorie intake", "aria-valuenow", "25");
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "stroke-dashoffset",
    "75",
    true,
  );
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await assertHomeIntake(page, "Daily calorie intake", "aria-valuenow", "0");
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "stroke-dashoffset",
    "100",
    true,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await assertHomeIntake(page, "Daily calorie intake", "aria-valuenow", "25");
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await assertHomeIntake(page, "Daily calorie intake", "aria-valuenow", "25");
});
test("menu operations do not clutter chat and prior internal prompts are removed", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    s.chat = [
      {
        id: "old",
        role: "user",
        text: "Generate a complete seven-day draft menu with 3 meals per day, respecting all preferences, dislikes and allergies, around 1800 kcal/day. Include oil and visible nutrition assumptions.",
      },
      { id: "real", role: "user", text: "I want soup" },
    ];
    localStorage.setItem("nudge.local.v1", JSON.stringify(s));
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.locator(".bubble.user")).toHaveCount(1);
  await page.route("**/api/chat", async (r) => {
    expect(r.request().postDataJSON().operation).toBe("menu");
    await r.fulfill({ status: 502, json: { error: "Fixture error" } });
  });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Create my weekly draft" }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture error");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.locator(".bubble.user")).toHaveCount(1);
  await expect(page.locator(".bubble.user")).toContainText("I want soup");
});
test("first-entry AI request asks portions without displaying internal instructions", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    s.pending = "eggs and bread";
    localStorage.setItem("nudge.local.v1", JSON.stringify(s));
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.route("**/api/chat", async (r) => {
    expect(r.request().postDataJSON().message).toBe("I ate eggs and bread");
    await r.fulfill({
      json: {
        message:
          "How many eggs and slices of bread, and how were they prepared?",
        kind: "message",
        foods: [],
        days: [],
      },
    });
  });
  await page.getByRole("button", { name: "Estimate with AI" }).click();
  await expect(page.locator(".bubble.user")).toHaveText("I ate eggs and bread");
  await expect(page.locator(".chat-line .bubble.assistant")).toContainText(
    "How many eggs",
  );
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
});
test("Swap previews an alternative beside the meal and preserves other meals and intake", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    s.plan = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      meals: ["Breakfast", "Lunch", "Dinner"].map((slot) => ({
        slot,
        name: `Original ${slot}`,
        portion: "1 bowl",
        ingredients: ["rice"],
        calories: 400,
        assumptions: "Fixture",
        approved: true,
      })),
    }));
    localStorage.setItem("nudge.local.v1", JSON.stringify(s));
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.locator(".day-card").first().locator(".day-toggle").click();
  await page.route("**/api/chat", async (r) => {
    const plan = r.request().postDataJSON().context.plan;
    plan[0].meals[1] = {
      ...plan[0].meals[1],
      name: "Chickpea bowl",
      ingredients: ["chickpeas"],
      calories: 450,
    };
    plan[0].meals[2].name = "Unrequested dinner change";
    await r.fulfill({
      json: { message: "Fixture", kind: "plan", foods: [], days: plan },
    });
  });
  await page
    .locator(".meal")
    .nth(1)
    .getByRole("button", { name: "Swap", exact: true })
    .click();
  const preview = page.getByRole("region", { name: "Proposed Lunch swap" });
  await expect(preview).toContainText("Chickpea bowl");
  await expect(page.locator(".meal").nth(1).locator("h3").first()).toHaveText(
    "Original Lunch",
  );
  await preview.getByRole("button", { name: "Keep this meal" }).click();
  await expect(preview).toHaveCount(0);
  await page
    .locator(".meal")
    .nth(1)
    .getByRole("button", { name: "Swap", exact: true })
    .click();
  await preview.getByRole("button", { name: "Add swap to draft" }).click();
  await expect(page.locator(".meal").nth(1).locator("h3").first()).toHaveText(
    "Chickpea bowl",
  );
  await expect(page.locator(".meal").nth(2).locator("h3").first()).toHaveText(
    "Original Dinner",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(saved.plan[0].meals[1].name).toBe("Original Lunch");
  expect(saved.foods).toHaveLength(0);
});
test("craving approval changes only today's dinner and confirmation updates three intake rings", async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("nutritionFixture")) return;
    sessionStorage.setItem("nutritionFixture", "yes");
    const s = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    const day = new Date();
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    s.foods = [
      {
        id: "earlier",
        date,
        name: "Dal and rice",
        portion: "Two meals",
        calories: 1000,
        protein: 30,
        fibre: 10,
        assumptions: "Test fixture",
      },
    ];
    s.plan = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      meals: ["Breakfast", "Lunch", "Dinner"].map((slot) => ({
        slot,
        name: "Original dal meal",
        portion: "1 bowl",
        ingredients: ["lentils"],
        calories: 600,
        protein: 20,
        fibre: 8,
        assumptions: "Test fixture",
        approved: true,
      })),
    }));
    localStorage.setItem("nudge.local.v1", JSON.stringify(s));
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.context.foodLogs).toHaveLength(1);
    expect(body.context.eaten).toBe(1000);
    expect(body.context.remaining).toBe(800);
    expect(body.context.nutrients.protein.value).toBe(30);
    await route.fulfill({
      json: {
        message:
          "One medium samosa is about 250 kcal. Here's a lighter dinner.",
        kind: "adjustment",
        days: [],
        foods: [
          {
            name: "Samosa",
            portion: "1 medium samosa",
            calories: 250,
            protein: 5,
            fibre: 3,
            assumptions: "Fried, approximate portion",
          },
        ],
        adjustments: [
          {
            day: body.context.weekday,
            meal: {
              slot: "Dinner",
              name: "Dal, sabzi and roti",
              portion: "1 katori dal, 1 katori sabzi, 1 roti",
              ingredients: ["lentils", "vegetables", "wheat", "oil"],
              calories: 500,
              protein: 18,
              fibre: 9,
              assumptions: "1 tsp oil included",
              approved: false,
            },
          },
        ],
      },
    });
  });
  const request = async () => {
    await page
      .getByLabel("Message", { exact: true })
      .fill("I'm craving a samosa. Can it fit? Adjust dinner.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Make room for your craving?")).toBeVisible();
  };
  await request();
  await page.getByRole("button", { name: "Reject adjustment" }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("nudge.local.v1")!).plan.every((d: any) =>
        d.meals.every((m: any) => m.name === "Original dal meal"),
      ),
    ),
  ).toBe(true);
  await request();
  await page.getByRole("button", { name: "Approve dinner adjustment" }).click();
  await expect(
    page.getByRole("button", { name: "I ate it — log food" }),
  ).toBeVisible();
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "aria-valuetext",
    "1000 of 1800 kcal",
  );
  const changed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(
    changed.plan
      .flatMap((d: any) => d.meals)
      .filter((m: any) => m.name === "Dal, sabzi and roti"),
  ).toHaveLength(1);
  expect(changed.foods).toHaveLength(1);
  await page.getByRole("button", { name: "I ate it — log food" }).click();
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "aria-valuetext",
    "1250 of 1800 kcal",
  );
  await assertHomeIntake(
    page,
    "Daily protein intake",
    "aria-valuetext",
    "35 of 60 g",
  );
  await assertHomeIntake(
    page,
    "Daily fibre intake",
    "aria-valuetext",
    "13 of 25 g",
  );
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await assertHomeIntake(
    page,
    "Daily protein intake",
    "aria-valuetext",
    "35 of 60 g",
  );
  await page.screenshot({
    path: "/tmp/nudge-three-intake-rings.png",
    fullPage: true,
  });
});

test("manual nutrient edits and deletion recalculate without treating unknown values as zero", async ({
  page,
}) => {
  await seed(page);
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("Chana salad");
  await page.getByLabel("Portion", { exact: true }).fill("1 katori");
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("250");
  await page.getByLabel("Protein (g)", { exact: true }).fill("12");
  await page.getByLabel("Fibre (g)", { exact: true }).fill("8");
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  const protein = page.getByRole("progressbar", {
    name: "Daily protein intake",
  });
  const fibre = page.getByRole("progressbar", { name: "Daily fibre intake" });
  await assertHomeIntake(
    page,
    "Daily protein intake",
    "aria-valuetext",
    "12 of 60 g",
  );
  await assertHomeIntake(
    page,
    "Daily fibre intake",
    "aria-valuetext",
    "8 of 25 g",
  );
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Protein (g)", { exact: true }).fill("15");
  await page.getByLabel("Fibre (g)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await assertHomeIntake(
    page,
    "Daily protein intake",
    "aria-valuetext",
    "15 of 60 g",
  );
  await assertHomeIntake(
    page,
    "Daily fibre intake",
    "aria-valuetext",
    "0 of 25 g; 1 entries missing nutrition",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await assertHomeIntake(
    page,
    "Daily fibre intake",
    "aria-valuetext",
    "8 of 25 g",
  );
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await assertHomeIntake(
    page,
    "Daily protein intake",
    "aria-valuetext",
    "0 of 60 g",
  );
  await assertHomeIntake(
    page,
    "Daily fibre intake",
    "aria-valuetext",
    "0 of 25 g",
  );
});
test("a dinner adjustment cannot overwrite intake changed since the suggestion", async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("staleFixture")) return;
    sessionStorage.setItem("staleFixture", "yes");
    const s = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    s.plan = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      meals: ["Breakfast", "Lunch", "Dinner"].map((slot) => ({
        slot,
        name: "Original dal",
        portion: "1 bowl",
        ingredients: ["lentils"],
        calories: 500,
        assumptions: "Estimate",
        approved: true,
      })),
    }));
    localStorage.setItem("nudge.local.v1", JSON.stringify(s));
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        kind: "adjustment",
        message: "Dinner suggestion",
        days: [],
        foods: [
          {
            name: "Samosa",
            portion: "1 medium",
            calories: 250,
            protein: 5,
            fibre: 3,
            assumptions: "Fried",
          },
        ],
        adjustments: [
          {
            day: body.context.weekday,
            meal: {
              slot: "Dinner",
              name: "Revised dal",
              portion: "1 small bowl",
              ingredients: ["lentils"],
              calories: 350,
              protein: 15,
              fibre: 5,
              assumptions: "Estimate",
            },
          },
        ],
      },
    });
  });
  await page
    .getByLabel("Message", { exact: true })
    .fill("Craving a samosa, adjust dinner");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Make room for your craving?")).toBeVisible();
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("Banana");
  await page.getByLabel("Portion", { exact: true }).fill("1 medium");
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await page.getByRole("button", { name: "Approve dinner adjustment" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "changed since this suggestion",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(saved.foods).toHaveLength(1);
  expect(
    saved.plan
      .flatMap((d: any) => d.meals)
      .every((m: any) => m.name === "Original dal"),
  ).toBe(true);
});
test("food logging estimates two eggs without asking for calories or using Gemini", async ({
  page,
}) => {
  await seed(page);
  let calls = 0;
  await page.route("**/api/chat", (r) => {
    calls++;
    return r.fulfill({ status: 503, json: { error: "Unavailable" } });
  });
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("2 eggs");
  await expect(
    page.getByLabel("Estimated calories", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Food", { exact: true }).press("Enter");
  await page.locator(".estimate-details summary").click();
  await expect(
    page.getByText("Standard food reference · estimated"),
  ).toBeVisible();
  await expect(
    page.getByText("156 kcal · 12.6 g protein · 0 g fibre"),
  ).toBeVisible();
  expect(calls).toBe(0);
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "aria-valuetext",
    "0 of 1800 kcal",
  );
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "aria-valuetext",
    "156 of 1800 kcal",
  );
  await assertHomeIntake(
    page,
    "Daily protein intake",
    "aria-valuetext",
    "12.6 of 60 g",
  );
});
test("an unfamiliar food description opens AI review without typed nutrition", async ({
  page,
}) => {
  await seed(page);
  await page.route("**/api/chat", async (r) => {
    expect(r.request().postDataJSON().message).toContain(
      "I ate 1 katori chana chaat",
    );
    await r.fulfill({
      json: {
        message: "Here's an estimate assuming a 150 ml katori, no extra oil.",
        kind: "log",
        foods: [
          {
            name: "Chana chaat",
            portion: "1 katori (150 ml)",
            calories: 200,
            protein: 9,
            fibre: 7,
            assumptions: "Recipe estimate, no added oil",
          },
        ],
        days: [],
      },
    });
  });
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("1 katori chana chaat");
  await page.getByRole("button", { name: "Estimate & review" }).click();
  await expect(
    page.getByText("Here’s the estimate. Shall I add it?"),
  ).toBeVisible();
  await expect(
    page.getByText("200 kcal · 9 g protein · 7 g fibre"),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/nudge-screen6-preview.png",
    fullPage: true,
  });
  await assertHomeIntake(page, "Daily calorie intake", "aria-valuenow", "0");
});
test("confirmed extra food offers lunch and dinner review without double-counting intake", async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("remainingReviewFixture")) return;
    sessionStorage.setItem("remainingReviewFixture", "yes");
    const s = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    s.plan = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      meals: ["Breakfast", "Lunch", "Dinner"].map((slot) => ({
        slot,
        name: "Original dal",
        portion: "1 bowl",
        ingredients: ["dal"],
        calories: 500,
        protein: 15,
        fibre: 7,
        assumptions: "Estimate",
        approved: true,
      })),
    }));
    localStorage.setItem("nudge.local.v1", JSON.stringify(s));
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page
    .locator(".quick-actions")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.getByLabel("Food", { exact: true }).fill("1 medium samosa");
  await page.getByLabel("Portion", { exact: true }).fill("80 g");
  await nutritionOverride(page);
  await page.getByLabel("Estimated calories", { exact: true }).fill("250");
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Review remaining meals" }),
  ).toBeVisible();
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.operation).toBe("adjustment");
    expect(body.context.adjustmentSlots).toEqual(["Lunch", "Dinner"]);
    expect(body.context.eaten).toBe(250);
    await route.fulfill({
      json: {
        message: "Here are lunch and dinner suggestions",
        kind: "adjustment",
        foods: [],
        days: [],
        adjustments: ["Lunch", "Dinner"].map((slot) => ({
          day: body.context.weekday,
          meal: {
            slot,
            name: `${slot} revised dal`,
            portion: "1 small bowl",
            ingredients: ["dal"],
            calories: 400,
            protein: 12,
            fibre: 6,
            assumptions: "Estimate",
          },
        })),
      },
    });
  });
  await page.getByRole("button", { name: "Review lunch & dinner" }).click();
  await expect(
    page.getByText("Today's revised lunch: Lunch revised dal"),
  ).toBeVisible();
  await expect(
    page.getByText("Today's revised dinner: Dinner revised dal"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve lunch & dinner adjustment" })
    .click();
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "aria-valuetext",
    "250 of 1800 kcal",
  );
  await expect(
    page.getByRole("button", { name: "I ate it — log food" }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(saved.foods).toHaveLength(1);
  expect(
    saved.plan
      .flatMap((d: any) => d.meals)
      .filter((m: any) => m.name.includes("revised")),
  ).toHaveLength(2);
  expect(saved.plan.every((d: any) => d.meals[0].name === "Original dal")).toBe(
    true,
  );
});

test("chat input stays above navigation while reading a long conversation", async ({
  page,
}) => {
  await seed(page);
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: {
        kind: "message",
        message: "Lunch options and preparation assumptions. ".repeat(100),
        foods: [],
        days: [],
        adjustments: [],
      },
    }),
  );
  await page
    .getByLabel("Message", { exact: true })
    .fill("What can I have for lunch?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".bubble.assistant").last()).toContainText(
    "Lunch options",
  );
  for (const width of [390, 320, 900]) {
    await page.setViewportSize({ width, height: 844 });
    for (const scroll of [0, 500, 99999]) {
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      const input = await page
        .getByLabel("Message", { exact: true })
        .boundingBox();
      const nav = await page
        .getByRole("navigation", { name: "Main navigation" })
        .boundingBox();
      expect(input).not.toBeNull();
      expect(nav).not.toBeNull();
      expect(input!.y).toBeGreaterThan(0);
      expect(input!.y + input!.height).toBeLessThanOrEqual(nav!.y);
      expect(input!.x).toBeGreaterThanOrEqual(0);
      expect(input!.x + input!.width).toBeLessThanOrEqual(width);
    }
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveCount(0);
});

test("Home rings align despite missing nutrient captions and Log food has no rings", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    state.foods = [
      {
        id: "alignment",
        date,
        name: "Toast",
        portion: "1 slice",
        calories: 100,
        assumptions: "Unknown nutrients",
      },
    ];
    localStorage.setItem("nudge.local.v1", JSON.stringify(state));
  });
  await page.reload();
  const rings = page.getByRole("progressbar");
  await expect(rings).toHaveCount(3);
  const boxes = await Promise.all(
    [0, 1, 2].map((i) => rings.nth(i).boundingBox()),
  );
  expect(boxes.every((b) => b !== null)).toBe(true);
  expect(
    Math.max(...boxes.map((b) => b!.y)) - Math.min(...boxes.map((b) => b!.y)),
  ).toBeLessThan(1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator(".calorie-ring")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Help me plan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Help me plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your weekly menu" }),
  ).toBeVisible();
});

test("retrying a failed craving keeps one user bubble and never logs the intended food", async ({
  page,
}) => {
  await seed(page);
  let attempts = 0;
  await page.route("**/api/chat", (r) => {
    attempts++;
    if (attempts === 1)
      return r.fulfill({
        status: 502,
        json: { error: "Craving reply unavailable" },
      });
    return r.fulfill({
      json: {
        message: "What size brownie are you considering?",
        kind: "message",
        foods: [],
        days: [],
        adjustments: [],
      },
    });
  });
  await page
    .getByLabel("Message", { exact: true })
    .fill("i want to eat a chocolate brownie");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Craving reply unavailable",
  );
  await page.getByRole("button", { name: "Retry AI", exact: true }).click();
  await expect(page.locator(".bubble.assistant").last()).toContainText(
    "What size brownie",
  );
  await expect(page.locator(".bubble.user")).toHaveCount(1);
  expect(attempts).toBe(2);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods,
    ),
  ).toHaveLength(0);
});

test("multi-turn conversation uses optional server actions, corrects a preview, and counts only confirmation", async ({
  page,
}) => {
  await seed(page);
  const brownie = {
    name: "Homemade brownie",
    portion: "1 small square (40 g)",
    calories: 180,
    protein: 3,
    fibre: 1,
    assumptions: "Recipe estimate including butter, no frosting",
  };
  const turns = [
    {
      message: "feeling exhausted",
      reply: "That sounds tiring. We can keep food simple today.",
    },
    {
      message: "I fancy a brownie",
      reply: "What size brownie are you thinking of?",
    },
    {
      message: "small homemade",
      reply:
        "A small homemade square might be around 180 kcal. Have you eaten it yet?",
    },
    {
      message: "I ate half",
      reply: "Here is a preview for half a small brownie.",
      food: {
        ...brownie,
        portion: "Half a small square (20 g)",
        calories: 90,
        protein: 1.5,
        fibre: 0.5,
      },
    },
    {
      message: "actually the whole piece",
      reply: "Updated that preview to the whole piece.",
      food: brownie,
    },
    {
      message: "thanks, you're a lifesaver",
      reply: "You’re welcome. No perfect days required.",
    },
  ];
  await page.route("**/api/chat", async (route) => {
    const result = await handleApi(
      new Request("https://nudge.example/api/chat", {
        method: "POST",
        body: route.request().postData()!,
      }),
      { NUDGE_GEMINI_API_KEY: "test-only" },
      async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(init.body as string);
        const message = payload.contents.at(-1).parts.at(-1).text;
        const turn = turns.find((t) => t.message === message)!;
        expect(turn).toBeDefined();
        expect(payload.generationConfig).not.toHaveProperty(
          "responseJsonSchema",
        );
        if (message === "actually the whole piece")
          expect(
            JSON.parse(
              payload.contents
                .at(-1)
                .parts[0].text.split(": ")
                .slice(1)
                .join(": "),
            ).currentPreview.foods[0].calories,
          ).toBe(90);
        const part = turn.food
          ? {
              functionCall: {
                name: "preview_food_log",
                args: {
                  message: turn.reply,
                  consumptionEvidence: "I ate half",
                  foods: [turn.food],
                },
              },
            }
          : { text: turn.reply };
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [part] } }] }),
        );
      },
    );
    await route.fulfill({ status: result.status, json: await result.json() });
  });
  for (const turn of turns.slice(0, 5)) {
    await page.getByLabel("Message", { exact: true }).fill(turn.message);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".bubble.assistant").last()).toContainText(
      turn.reply,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods,
      ),
    ).toHaveLength(0);
  }
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "aria-valuetext",
    "180 of 1800 kcal",
  );
  const final = turns.at(-1)!;
  await page.getByLabel("Message", { exact: true }).fill(final.message);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".bubble.assistant").last()).toContainText(
    final.reply,
  );
  const foods = await page.evaluate(
    () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods,
  );
  expect(foods).toHaveLength(1);
  expect(foods[0].calories).toBe(180);
});

test("chat logs approved draft menu meals with their original nutrition only after confirmation", async ({
  page,
}) => {
  await seed(page);
  const weekday = await page.evaluate(
    () =>
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()],
  );
  const meal = {
    slot: "Breakfast",
    name: "Poha",
    portion: "1 katori (150 g)",
    ingredients: ["rice flakes", "oil"],
    calories: 310,
    protein: 7,
    fibre: 4,
    assumptions: "Includes 5 ml oil",
    approved: true,
  };
  await page.evaluate(
    ({ weekday, meal }) => {
      const state = JSON.parse(localStorage.getItem("nudge.local.v1")!);
      state.draft = [
        {
          day: weekday,
          meals: [
            meal,
            {
              ...meal,
              slot: "Lunch",
              name: "Rajma rice",
              calories: 450,
              protein: 15,
              fibre: 9,
            },
            { ...meal, slot: "Dinner", name: "Dal", approved: false },
          ],
        },
      ];
      localStorage.setItem("nudge.local.v1", JSON.stringify(state));
    },
    { weekday, meal },
  );
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.context.plan).toEqual([]);
    expect(body.context.approvedMenu[0].meals.map((m: any) => m.name)).toEqual([
      "Poha",
      "Rajma rice",
    ]);
    const response = await handleApi(
      new Request("https://nudge.example/api/chat", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { NUDGE_GEMINI_API_KEY: "test" },
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "preview_menu_log",
                        args: {
                          message:
                            "Your planned breakfast and lunch are ready to confirm.",
                          consumptionEvidence: body.message,
                          day: weekday,
                          slots: ["Breakfast", "Lunch"],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }),
        ),
    );
    await route.fulfill({
      status: response.status,
      json: await response.json(),
    });
  });
  await page
    .getByPlaceholder("Food, cravings, or just a chat…")
    .fill("I ate my approved menu breakfast and lunch");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Poha", { exact: true })).toBeVisible();
  await expect(page.getByText("Rajma rice", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods,
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods.length,
      ),
    )
    .toBe(2);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(
    stored.foods.map((f: any) => [f.name, f.calories, f.menuSlot]),
  ).toEqual([
    ["Poha", 310, "Breakfast"],
    ["Rajma rice", 450, "Lunch"],
  ]);
  expect(stored.plan).toEqual([]);
  await assertHomeIntake(
    page,
    "Daily calorie intake",
    "aria-valuetext",
    "760 of 1800 kcal",
  );
});

test("message field grows for long text and supports editing in the middle", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Let’s get started", exact: true })
    .click();
  const field = page.getByRole("textbox", { name: "Message", exact: true });
  await expect(field).toHaveJSProperty("tagName", "TEXTAREA");
  const initial = (await field.boundingBox())!.height;
  const content =
    "I had breakfast with two eggs and toast. Then I had rajma rice for lunch. I would like to talk about dinner and review exactly what I have written before sending this message.\nAlso I had tea with milk.";
  await field.fill(content);
  expect((await field.boundingBox())!.height).toBeGreaterThan(initial);
  await field.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(6, 15),
  );
  await field.press("Backspace");
  await field.type("a snack");
  await expect(field).toHaveValue(
    content.slice(0, 6) + "a snack" + content.slice(15),
  );
  await field.fill("Long food message. ".repeat(100));
  expect((await field.boundingBox())!.height).toBeLessThanOrEqual(160);
  expect(await field.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
});

test("dictation inserts at selection and does not repeat final results or overwrite later edits", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      onstart: any;
      onresult: any;
      onend: any;
      onerror: any;
      start() {
        (window as any).testSpeech = this;
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    (window as any).SpeechRecognition = FakeRecognition;
  });
  await seed(page);
  const field = page.getByRole("textbox", { name: "Message", exact: true });
  await field.fill("I had toast today");
  await field.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(6, 11),
  );
  await page.getByRole("button", { name: "Start dictation" }).click();
  const emit = async () =>
    page.evaluate(() => {
      const result: any = [{ transcript: "two eggs" }];
      result.isFinal = true;
      (window as any).testSpeech.onresult({
        resultIndex: 0,
        results: [result],
      });
    });
  await emit();
  await expect(field).toHaveValue("I had two eggs today");
  await emit();
  await expect(field).toHaveValue("I had two eggs today");
  await field.fill("I had three eggs today");
  await emit();
  await expect(field).toHaveValue("I had three eggs today");
});

test("craving choices use the remaining budget and choosing one does not change the menu or intake", async ({
  page,
}) => {
  await seed(page);
  const date = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page.evaluate((date) => {
    const state = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    state.foods = [
      {
        id: "eaten",
        date,
        name: "Meals already eaten",
        portion: "Today",
        calories: 1400,
        protein: 40,
        fibre: 15,
        assumptions: "Confirmed estimate",
      },
    ];
    localStorage.setItem("nudge.local.v1", JSON.stringify(state));
  }, date);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  let calls = 0;
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.context.remaining).toBe(400);
    if (calls++)
      expect(
        body.context.history.some(
          (turn: any) =>
            turn.role === "assistant" && turn.text.includes("Cocoa yoghurt"),
        ),
      ).toBe(true);
    const response = await handleApi(
      new Request("https://nudge.example/api/chat", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { NUDGE_GEMINI_API_KEY: "test" },
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text:
                        calls === 1
                          ? "You have about 400 kcal remaining. Three chocolatey options:\n1. Cocoa yoghurt — 150 g plain yoghurt, 1 tsp cocoa: about 120–150 kcal, unsweetened.\n2. Chocolate banana — half a banana and 10 g melted dark chocolate: about 110–130 kcal.\n3. Cocoa oats — 20 g oats, 100 ml milk, 1 tsp cocoa: about 150–180 kcal, no added sugar.\nWhich sounds good?"
                          : "For the second option, slice half a banana and drizzle 10 g melted dark chocolate over it. This is still only an idea; tell me if you eat it.",
                    },
                  ],
                },
              },
            ],
          }),
        ),
    );
    await route.fulfill({
      status: response.status,
      json: await response.json(),
    });
  });
  const send = async (text: string) => {
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(text);
    await page.getByRole("button", { name: "Send message" }).click();
  };
  await send("I feel like eating something chocolatey");
  await expect(page.getByText("Cocoa yoghurt", { exact: false })).toBeVisible();
  await send("the second one");
  await expect(
    page.getByText("slice half a banana", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm & log", exact: true }),
  ).toHaveCount(0);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(state.foods).toHaveLength(1);
  expect(state.plan).toEqual([]);
  expect(state.draft).toEqual([]);
});

test("quick onboarding skips measurements and supports logging with no hidden calorie target", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { configured: true } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s get started" }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("I ate 2 eggs");
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .getByRole("combobox", { name: "Dietary preference", exact: true })
    .selectOption("eggetarian");
  await page.getByRole("button", { name: "No known allergies — None" }).click();
  await expect(page.getByLabel("Height (cm)", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Start using Nudge" }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(stored.profile.budget).toBe(0);
  expect(stored.profile.height).toBe(0);
  expect(stored.pending).toBe("I ate 2 eggs");
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await expect(
    page.getByText("kcal logged today", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("no calorie target set", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/chat", (route) => {
    const body = route.request().postDataJSON();
    expect(body.context.remaining).toBeNull();
    expect(body.context.eaten).toBe(156);
    return route.fulfill({
      json: {
        message:
          "Here are some dessert ideas with estimated portions. You haven’t set a target yet.",
        kind: "message",
        foods: [],
        days: [],
      },
    });
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("I feel like something sweet");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Here are some dessert ideas", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create my weekly draft" }),
  ).toBeDisabled();
  await page
    .getByLabel("Daily calorie budget (kcal)", { exact: true })
    .fill("1800");
  await page
    .getByRole("combobox", { name: "Meals per day", exact: true })
    .selectOption("4");
  await page.getByRole("button", { name: "Save menu preferences" }).click();
  await expect(
    page.getByRole("button", { name: "Create my weekly draft" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods.length,
    ),
  ).toBe(1);
});

test("illustrated Home meals log their approved portions once and respect reduced motion", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date().getDay()
    ];
    state.plan = [
      {
        day: weekday,
        meals: [
          {
            slot: "Breakfast",
            name: "Poha",
            portion: "1 katori (150 g cooked)",
            ingredients: ["rice flakes", "5 ml oil"],
            calories: 310,
            protein: 7,
            fibre: 4,
            assumptions: "Includes 5 ml oil",
            approved: true,
          },
          {
            slot: "Lunch",
            name: "Rajma rice",
            portion: "1 bowl",
            ingredients: ["rice", "rajma"],
            calories: 450,
            protein: 15,
            fibre: 9,
            assumptions: "Estimate",
            approved: true,
          },
        ],
      },
    ];
    localStorage.setItem("nudge.local.v1", JSON.stringify(state));
  });
  await page.reload();
  const card = page.locator(".today-meal-card").first();
  await expect(card.getByRole("img")).toBeVisible();
  await expect(card).toContainText("Up next · planned");
  await card.getByRole("button", { name: "I ate this" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm & log" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("nudge.local.v1")!).foods.length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Confirm & log" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await page.getByText("Other meals today (1)", { exact: true }).click();
  await expect(
    page.locator(".today-meal-card").filter({ hasText: "Poha" }),
  ).toContainText("Eaten");
  await expect(
    page
      .locator(".today-meal-card")
      .filter({ hasText: "Poha" })
      .getByRole("button", { name: "Logged" }),
  ).toBeDisabled();
  await expect(
    page.locator(".today-meal-card").filter({ hasText: "Rajma rice" }),
  ).toContainText("Up next · planned");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "none",
  );
  await page.setViewportSize({ width: 320, height: 568 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(state.foods).toHaveLength(1);
  expect(state.foods[0]).toMatchObject({
    calories: 310,
    protein: 7,
    fibre: 4,
    menuSlot: "Breakfast",
  });
  expect(state.plan[0].meals[0].approved).toBe(true);
});

test("Home food logs have illustrations while the planning card and saved intake stay unchanged", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("nudge.local.v1")!);
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    s.foods = [
      {
        id: "coffee",
        date,
        name: "Coffee",
        portion: "1 cup",
        calories: 35,
        assumptions: "Estimate",
      },
    ];
    localStorage.setItem("nudge.local.v1", JSON.stringify(s));
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Plan my meals", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".food-log-illustration").getByRole("img")).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 568 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Edit Coffee", exact: true }).click();
  await expect(page.getByLabel("Portion", { exact: true })).toHaveValue(
    "1 cup",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nudge.local.v1")!),
  );
  expect(state.foods).toHaveLength(1);
  expect(state.foods[0].calories).toBe(35);
  expect(state.plan).toEqual([]);
});
