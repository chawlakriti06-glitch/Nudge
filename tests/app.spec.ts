import { test, expect, type Page } from "@playwright/test";
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
};
test("manual onboarding retains welcome food, confirms once, reloads, edits and deletes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s get started" }).click();
  await page.getByLabel("Message", { exact: true }).fill("I ate 2 samosas");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: "No known allergies — None" }).click();
  await page
    .getByLabel("Dietary preference", { exact: true })
    .selectOption("vegetarian");
  await page.getByLabel("Daily calorie budget (kcal)").fill("1800");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("I ate 2 samosas", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Portion", { exact: true }).fill("2 medium samosas");
  await page.getByLabel("Estimated calories", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Confirm & log" }).click();
  await expect(
    page.getByText("1,300 kcal remaining", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("1,300 kcal remaining", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
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
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(
    page.getByText("Suggestions paused today.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log manually" }).click();
  await page.getByLabel("Food", { exact: true }).fill("Toast");
  await page.getByLabel("Portion", { exact: true }).fill("1 bread slice");
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
  await page.getByRole("button", { name: "Chat", exact: true }).click();
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
  for (const tab of ["Chat", "Menu", "Profile"]) {
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
  await expect(page.getByText("Count this as eaten?")).toBeVisible();
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Count this as eaten?")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await expect(page.getByText("1,300 kcal remaining")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm & log", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("1,300 kcal remaining")).toBeVisible();
});
test("different days, nutrient totals and undo recalculate independently", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Log manually" }).click();
  await page.getByLabel("Food", { exact: true }).fill("Rice");
  await page.getByLabel("Portion", { exact: true }).fill("100 g cooked");
  await page.getByLabel("Estimated calories", { exact: true }).fill("130");
  await page.getByLabel("Date", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Confirm & log" }).click();
  await expect(page.getByText("1,800 kcal remaining")).toBeVisible();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByLabel("Ledger date").fill("2026-01-01");
  await expect(page.getByText("130 kcal eaten · estimated")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Daily protein intake" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(
    page.getByRole("progressbar", { name: "Daily fibre intake" }),
  ).toHaveAttribute("aria-valuenow", "0");
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
  await expect(ring).toHaveAttribute("aria-valuenow", "0");
  await expect(arc).toHaveAttribute("stroke-dashoffset", "100");
  await page.getByRole("button", { name: "Log manually" }).click();
  await page.getByLabel("Food", { exact: true }).fill("Lunch");
  await page.getByLabel("Portion", { exact: true }).fill("1 plate");
  await page.getByLabel("Estimated calories", { exact: true }).fill("900");
  await expect(ring).toHaveAttribute("aria-valuenow", "0");
  await page
    .getByRole("button", { name: "Confirm & log", exact: true })
    .click();
  await expect(ring).toHaveAttribute("aria-valuenow", "50");
  await expect(arc).toHaveAttribute("stroke-dashoffset", "50");
  await expect(
    page.getByText("900 kcal remaining", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Estimated calories", { exact: true }).fill("450");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(ring).toHaveAttribute("aria-valuenow", "25");
  await expect(arc).toHaveAttribute("stroke-dashoffset", "75");
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(ring).toHaveAttribute("aria-valuenow", "0");
  await expect(arc).toHaveAttribute("stroke-dashoffset", "100");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(ring).toHaveAttribute("aria-valuenow", "25");
  await page.reload();
  await expect(ring).toHaveAttribute("aria-valuenow", "25");
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
  await expect(page.locator(".bubble.user")).toHaveCount(1);
  await page.route("**/api/chat", async (r) => {
    expect(r.request().postDataJSON().operation).toBe("menu");
    await r.fulfill({ status: 502, json: { error: "Fixture error" } });
  });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Create my weekly draft" }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture error");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
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
  await page.getByRole("button", { name: "Menu", exact: true }).click();
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
  await expect(
    page.getByRole("progressbar", { name: "Daily calorie intake" }),
  ).toHaveAttribute("aria-valuetext", "1000 of 1800 kcal");
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
  await expect(
    page.getByRole("progressbar", { name: "Daily calorie intake" }),
  ).toHaveAttribute("aria-valuetext", "1250 of 1800 kcal");
  await expect(
    page.getByRole("progressbar", { name: "Daily protein intake" }),
  ).toHaveAttribute("aria-valuetext", "35 of 60 g");
  await expect(
    page.getByRole("progressbar", { name: "Daily fibre intake" }),
  ).toHaveAttribute("aria-valuetext", "13 of 25 g");
  await page.reload();
  await expect(
    page.getByRole("progressbar", { name: "Daily protein intake" }),
  ).toHaveAttribute("aria-valuetext", "35 of 60 g");
  await page.screenshot({
    path: "/tmp/nudge-three-intake-rings.png",
    fullPage: true,
  });
});

test("manual nutrient edits and deletion recalculate without treating unknown values as zero", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Log manually" }).click();
  await page.getByLabel("Food", { exact: true }).fill("Chana salad");
  await page.getByLabel("Portion", { exact: true }).fill("1 katori");
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
  await expect(protein).toHaveAttribute("aria-valuetext", "12 of 60 g");
  await expect(fibre).toHaveAttribute("aria-valuetext", "8 of 25 g");
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Protein (g)", { exact: true }).fill("15");
  await page.getByLabel("Fibre (g)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(protein).toHaveAttribute("aria-valuetext", "15 of 60 g");
  await expect(fibre).toHaveAttribute(
    "aria-valuetext",
    "0 of 25 g; 1 entries missing nutrition",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(fibre).toHaveAttribute("aria-valuetext", "8 of 25 g");
  await page.getByRole("button", { name: "Open food ledger" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(protein).toHaveAttribute("aria-valuetext", "0 of 60 g");
  await expect(fibre).toHaveAttribute("aria-valuetext", "0 of 25 g");
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
  await page.getByRole("button", { name: "Log manually" }).click();
  await page.getByLabel("Food", { exact: true }).fill("Banana");
  await page.getByLabel("Portion", { exact: true }).fill("1 medium");
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
