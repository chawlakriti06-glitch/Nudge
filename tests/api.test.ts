import { test, expect } from "vitest";
import { readApiJson } from "../src/api";
// JS handler is also the actual Netlify entry point.
// @ts-expect-error standalone JavaScript module
import handler from "../netlify/functions/api.mjs";
// @ts-expect-error standalone JavaScript module
import { handleApi } from "../server/api.mjs";
const request = (
  body: unknown = {
    message: "Generate a menu",
    context: { profile: { meals: 3 } },
  },
) =>
  new Request("https://nudge.example/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
test("HTML fallback produces actionable error instead of browser parse message", async () => {
  await expect(
    readApiJson(
      new Response("<!doctype html>", {
        headers: { "content-type": "text/html" },
      }),
    ),
  ).rejects.toThrow("API functions");
});
test("malformed JSON produces readable error", async () => {
  await expect(
    readApiJson(
      new Response("{", { headers: { "content-type": "application/json" } }),
    ),
  ).rejects.toThrow("unreadable response");
});
test("Netlify function routing returns JSON status and missing-key response", async () => {
  const saved = {
    key: process.env.NUDGE_GEMINI_API_KEY,
    model: process.env.NUDGE_GEMINI_MODEL,
  };
  delete process.env.NUDGE_GEMINI_API_KEY;
  delete process.env.NUDGE_GEMINI_MODEL;
  try {
    const status = await handler(
      new Request("https://nudge.example/.netlify/functions/api/status"),
    );
    expect(await status.json()).toEqual({
      configured: false,
      model: "gemini-3.5-flash-lite",
    });
    const r = await handler(request());
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain("NUDGE_GEMINI_API_KEY");
  } finally {
    for (const [k, v] of [
      ["NUDGE_GEMINI_API_KEY", saved.key],
      ["NUDGE_GEMINI_MODEL", saved.model],
    ])
      if (v === undefined) delete process.env[k!];
      else process.env[k!] = v;
  }
});
test("provider call stays server-side and uses configurable model, mocked transport only", async () => {
  const env = {
    NUDGE_GEMINI_API_KEY: "test-only-placeholder",
    NUDGE_GEMINI_MODEL: "gemini-test-model",
  };
  const r = await handleApi(request(), env, async (url: string, opts: any) => {
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent",
    );
    expect(opts.headers["x-goog-api-key"]).toBe("test-only-placeholder");
    expect(JSON.parse(opts.body)).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    message: "Test fixture",
                    kind: "message",
                    foods: [],
                    days: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
  });
  expect(r.status).toBe(200);
  expect((await r.json()).message).toBe("Test fixture");
});
test("invalid requests and provider failures return JSON without applying output", async () => {
  const env = {
    NUDGE_GEMINI_API_KEY: "test",
    NUDGE_GEMINI_MODEL: "gemini-test",
  };
  expect((await handleApi(request(null), env)).status).toBe(400);
  expect(
    (
      await handleApi(
        request(),
        env,
        async () => new Response("", { status: 401 }),
      )
    ).status,
  ).toBe(502);
});
test("Gemini free-tier 429 has helpful copy and makes no paid fallback request", async () => {
  let calls = 0;
  const r = await handleApi(
    request(),
    { NUDGE_GEMINI_API_KEY: "test-only" },
    async () => {
      calls++;
      return new Response("", { status: 429 });
    },
  );
  expect(calls).toBe(1);
  expect((await r.json()).error).toContain("No paid fallback");
});
test("an old OpenAI key alone cannot enable or be sent to Gemini", async () => {
  let called = false;
  const r = await handleApi(
    request(),
    { NUDGE_API_KEY: "old-test-only", NUDGE_MODEL: "openai-test" },
    async () => {
      called = true;
    },
  );
  expect(r.status).toBe(503);
  expect(called).toBe(false);
});
test("truncated Gemini output is rejected without a partial proposal", async () => {
  const r = await handleApi(
    request(),
    { NUDGE_GEMINI_API_KEY: "test-only" },
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "MAX_TOKENS",
              content: { parts: [{ text: '{"message":' }] },
            },
          ],
        }),
      ),
  );
  expect(r.status).toBe(502);
  expect((await r.json()).error).toContain("could not finish");
});

test("diagnostics show exact model and list supported names without disclosing keys", async () => {
  const env = {
    NUDGE_GEMINI_API_KEY: "test-only-secret",
    NUDGE_GEMINI_MODEL: " models/gemini-example ",
  };
  const r = await handleApi(
    new Request("https://test/api/models"),
    env,
    async () =>
      new Response(
        JSON.stringify({
          models: [
            {
              name: "models/gemini-example",
              supportedGenerationMethods: ["generateContent"],
            },
            {
              name: "models/embedding",
              supportedGenerationMethods: ["embedContent"],
            },
          ],
        }),
      ),
  );
  const body = await r.json();
  expect(body.model).toBe("gemini-example");
  expect(body.availableModels).toEqual(["gemini-example"]);
  expect(JSON.stringify(body)).not.toContain("test-only-secret");
});
test("404 diagnostics retain Google model reason but redact the key", async () => {
  const r = await handleApi(
    request(),
    {
      NUDGE_GEMINI_API_KEY: "test-secret",
      NUDGE_GEMINI_MODEL: "gemini-example",
    },
    async () =>
      new Response(
        JSON.stringify({
          error: { message: "models/gemini-example not found. test-secret" },
        }),
        { status: 404 },
      ),
  );
  const body = await r.json();
  expect(body.error).toContain("gemini-example not found");
  expect(body.error).not.toContain("test-secret");
  expect(body.error).toContain("/api/models");
});

test.each([3, 4])(
  "menu schema enforces %i slots and normalizes returned order",
  async (count) => {
    const slots =
      count === 4
        ? ["Breakfast", "Lunch", "Snacks", "Dinner"]
        : ["Breakfast", "Lunch", "Dinner"];
    const response = {
      message: "Fixture",
      kind: "plan",
      foods: [],
      days: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((day) => ({
        day,
        meals: slots
          .map((slot) => ({
            slot,
            name: `${day} rice`,
            portion: "1 bowl",
            ingredients: ["rice"],
            calories: 300,
            assumptions: "Fixture",
          }))
          .reverse(),
      })),
    };
    const r = await handleApi(
      request({ message: "Menu", context: { profile: { meals: count } } }),
      { NUDGE_GEMINI_API_KEY: "test" },
      async (_url: string, opts: any) => {
        const payload = JSON.parse(opts.body);
        const meals =
          payload.generationConfig.responseJsonSchema.properties.days.properties
            .Mon.properties.meals;
        expect(meals.required).toEqual(slots);
        expect(Object.keys(meals.properties)).toEqual(slots);
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(response) }] } },
            ],
          }),
        );
      },
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.days[0].day).toBe("Mon");
    expect(body.days[0].meals.map((m: any) => m.slot)).toEqual(slots);
  },
);
test("incomplete menu is rejected rather than fabricated or saved", async () => {
  const bad = {
    message: "Fixture",
    kind: "plan",
    foods: [],
    days: [{ day: "Mon", meals: [] }],
  };
  const r = await handleApi(
    request(),
    { NUDGE_GEMINI_API_KEY: "test" },
    async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(bad) }] } }],
        }),
      ),
  );
  expect(r.status).toBe(502);
  expect((await r.json()).error).toContain("profile requires 3");
});

test.each([3, 4])(
  "full-week generation requires all seven named days with %i meals",
  async (count) => {
    const slots =
      count === 4
        ? ["Breakfast", "Lunch", "Snacks", "Dinner"]
        : ["Breakfast", "Lunch", "Dinner"];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const r = await handleApi(
      request({
        message: "Generate a complete seven-day draft menu",
        context: { profile: { meals: count } },
      }),
      { NUDGE_GEMINI_API_KEY: "test" },
      async (_url: string, opts: any) => {
        const schema = JSON.parse(opts.body).generationConfig
          .responseJsonSchema;
        expect(schema.properties.days.required).toEqual(days);
        expect(schema.properties.kind.enum).toEqual(["plan"]);
        for (const day of days) {
          expect(
            schema.properties.days.properties[day].properties.meals.required,
          ).toEqual(slots);
          for (const slot of slots)
            expect(
              schema.properties.days.properties[day].properties.meals
                .properties[slot].properties,
            ).not.toHaveProperty("slot");
        }
        const plan = {
          message: "Fixture",
          kind: "plan",
          foods: [],
          days: Object.fromEntries(
            days.map((day) => [
              day,
              {
                day: "Mon", // Named keys are authoritative, even if nested labels repeat.
                meals: Object.fromEntries(
                  slots.map((slot) => [
                    slot,
                    {
                      name: `${day} meal`,
                      portion: "1 bowl",
                      ingredients: ["rice"],
                      calories: 300,
                      assumptions: "Fixture",
                    },
                  ]),
                ),
              },
            ]),
          ),
        };
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(plan) }] } },
            ],
          }),
        );
      },
    );
    expect(r.status).toBe(200);
    const plan = await r.json();
    expect(plan.days.map((d: any) => d.day)).toEqual(days);
    expect(plan.days.every((d: any) => d.meals.length === count)).toBe(true);
    for (const day of plan.days)
      expect(day.meals.map((meal: any) => meal.slot)).toEqual(slots);
  },
);
test("a meal label gets one real provider correction, not a fabricated assistant answer", async () => {
  let calls = 0;
  const r = await handleApi(
    request({
      message: "I ate eggs and bread",
      context: { profile: { meals: 3 } },
    }),
    { NUDGE_GEMINI_API_KEY: "test" },
    async (_url: string, opts: any) => {
      calls++;
      const payload = JSON.parse(opts.body);
      expect(
        payload.generationConfig.responseJsonSchema.properties.kind.enum,
      ).toEqual(["message", "log", "adjustment"]);
      expect(payload.systemInstruction.parts[0].text).toContain(
        "how many eggs",
      );
      const message =
        calls === 1
          ? "Breakfast"
          : "How many eggs and bread slices did you have, and how were the eggs cooked?";
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      message,
                      kind: "message",
                      foods: [],
                      days: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  expect(calls).toBe(2);
  expect(r.status).toBe(200);
  expect((await r.json()).message).toContain("How many eggs");
});
test("unhelpful labels stop after one correction and never log food", async () => {
  let calls = 0;
  const r = await handleApi(
    request(),
    { NUDGE_GEMINI_API_KEY: "test" },
    async () => {
      calls++;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      message: "Breakfast",
                      kind: "message",
                      foods: [],
                      days: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  expect(calls).toBe(2);
  expect(r.status).toBe(502);
  expect((await r.json()).error).toContain("Nothing was logged");
});
test("rejects meat in vegetarian drafts and repetitive weekly breakfasts", async () => {
  for (const unsafe of ["chicken", "repetition"]) {
    const days = Object.fromEntries(
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => [
        day,
        {
          meals: Object.fromEntries(
            ["Breakfast", "Lunch", "Dinner"].map((slot) => [
              slot,
              {
                name: unsafe === "repetition" ? "Poha" : `${day} ${slot}`,
                portion: "1 katori (150 ml)",
                ingredients: [
                  unsafe === "chicken" && slot === "Lunch"
                    ? "chicken stock"
                    : "rice",
                ],
                calories: 300,
                assumptions: "1 tsp oil included",
              },
            ]),
          ),
        },
      ]),
    );
    const result = await handleApi(
      request({
        operation: "menu",
        message: "Generate a complete seven-day menu",
        context: { profile: { meals: 3, diet: "vegetarian" } },
      }),
      { NUDGE_GEMINI_API_KEY: "test-key", NUDGE_GEMINI_MODEL: "gemini-test" },
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        kind: "plan",
                        message: "Draft",
                        foods: [],
                        days,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        ),
    );
    expect(result.status).toBe(502);
    expect((await result.json()).error).toContain(
      unsafe === "chicken" ? "vegetarian" : "breakfasts",
    );
  }
});
test("food estimates use a compact schema and omit full-week instructions", async () => {
  const response = await handleApi(
    request({
      message: "i had 2 eggs and 1 bread toast. how many calories is that?",
      context: { profile: { meals: 4, diet: "non-vegetarian" } },
    }),
    { NUDGE_GEMINI_API_KEY: "test-key" },
    async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(init.body as string);
      expect(
        sent.generationConfig.responseJsonSchema.properties,
      ).not.toHaveProperty("days");
      expect(sent.generationConfig.responseJsonSchema.required).not.toContain(
        "days",
      );
      expect(sent.systemInstruction.parts[0].text).not.toContain(
        "Return the complete revised week. When the schema",
      );
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      message:
                        "How were the eggs cooked, and was butter added?",
                      kind: "message",
                      foods: [],
                      days: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  expect(response.status).toBe(200);
});
test("400 reports provider diagnosis while redacting the API key", async () => {
  const response = await handleApi(
    request(),
    { NUDGE_GEMINI_API_KEY: "private-test-key" },
    async () =>
      new Response(
        JSON.stringify({
          error: { message: "Schema too complex: private-test-key" },
        }),
        { status: 400 },
      ),
  );
  const body = await response.json();
  expect(body.error).toContain("Schema too complex");
  expect(body.error).not.toContain("private-test-key");
});
test("a short off-menu follow-up corrects meal-label food previews", async () => {
  let calls = 0;
  const response = await handleApi(
    request({
      message: "with 2 eggs",
      context: {
        profile: { meals: 3 },
        history: [{ role: "user", text: "I ate toast" }],
      },
    }),
    { NUDGE_GEMINI_API_KEY: "test-key" },
    async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(init.body as string);
      expect(
        sent.generationConfig.responseJsonSchema.properties,
      ).not.toHaveProperty("days");
      calls++;
      const foods =
        calls === 1
          ? [
              {
                name: "Breakfast",
                portion: "Breakfast",
                calories: 250,
                assumptions: "Breakfast",
              },
            ]
          : [
              {
                name: "Eggs and toast",
                portion: "2 eggs and 1 bread slice",
                calories: 230,
                assumptions: "Boiled eggs and plain toast; no added fat",
              },
            ];
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      kind: "log",
                      message: "Preview",
                      foods,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  expect(response.status).toBe(200);
  expect(calls).toBe(2);
  expect((await response.json()).foods[0].name).toBe("Eggs and toast");
});
test("schema rejection retries JSON mode on the same model and validates output", async () => {
  let calls = 0;
  const r = await handleApi(
    request({
      message: "I had 2 boiled eggs and 1 plain toast",
      context: { profile: { meals: 3 } },
    }),
    {
      NUDGE_GEMINI_API_KEY: "private-key",
      NUDGE_GEMINI_MODEL: "gemini-example",
    },
    async (url: string, init: RequestInit) => {
      expect(url).toContain("gemini-example:generateContent");
      const payload = JSON.parse(init.body as string);
      calls++;
      if (calls === 1) {
        expect(payload.generationConfig.responseJsonSchema).toBeDefined();
        return new Response(
          JSON.stringify({
            error: { message: "Request contains an invalid argument" },
          }),
          { status: 400 },
        );
      }
      expect(payload.generationConfig).not.toHaveProperty("responseJsonSchema");
      expect(payload.generationConfig.responseMimeType).toBe(
        "application/json",
      );
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      kind: "log",
                      message: "Food estimate",
                      foods: [
                        {
                          name: "Eggs and toast",
                          portion: "2 boiled eggs and 1 slice",
                          calories: 230,
                          protein: 15,
                          fibre: 2,
                          assumptions: "No butter or oil",
                        },
                      ],
                      adjustments: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  expect(calls).toBe(2);
  expect(r.status).toBe(200);
  expect((await r.json()).foods[0].protein).toBe(15);
});

test("a craving adjustment can only target a meal in today's approved menu", async () => {
  for (const proposedDay of ["Thu", "Fri"]) {
    const meal = {
      slot: "Dinner",
      name: "Dal roti",
      portion: "1 katori and 1 roti",
      ingredients: ["dal", "wheat"],
      calories: 450,
      protein: 18,
      fibre: 8,
      assumptions: "Oil included",
    };
    const r = await handleApi(
      request({
        message: "I'm craving a samosa, adjust dinner",
        context: {
          today: "2026-10-08",
          weekday: "Thu",
          profile: { meals: 3, diet: "vegetarian" },
          plan: [{ day: "Thu", meals: [meal] }],
        },
      }),
      { NUDGE_GEMINI_API_KEY: "test-key" },
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        kind: "adjustment",
                        message: "Proposed dinner",
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
                        adjustments: [{ day: proposedDay, meal }],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        ),
    );
    expect(r.status).toBe(proposedDay === "Thu" ? 200 : 502);
  }
});
