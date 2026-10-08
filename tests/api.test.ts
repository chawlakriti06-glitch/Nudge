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
      expect(payload.generationConfig).not.toHaveProperty("responseJsonSchema");
      expect(payload.toolConfig.functionCallingConfig.mode).toBe(
        calls === 1 ? "AUTO" : "NONE",
      );
      expect(
        payload.tools[0].functionDeclarations.map((f: any) => f.name),
      ).toContain("preview_food_log");
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
    request({ message: "I had eggs", context: { profile: { meals: 3 } } }),
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
test("food previews use an optional action tool and omit full-week instructions", async () => {
  const response = await handleApi(
    request({
      message: "i had 2 eggs and 1 bread toast. how many calories is that?",
      context: { profile: { meals: 4, diet: "non-vegetarian" } },
    }),
    { NUDGE_GEMINI_API_KEY: "test-key" },
    async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(init.body as string);
      if (sent.generationConfig.responseJsonSchema)
        expect(
          sent.generationConfig.responseJsonSchema.properties,
        ).not.toHaveProperty("days");
      else
        expect(sent.generationConfig).not.toHaveProperty("responseJsonSchema");
      expect(sent.contents.at(-1).parts.at(-1).text).toBe(
        "i had 2 eggs and 1 bread toast. how many calories is that?",
      );
      expect(
        sent.tools[0].functionDeclarations.find(
          (f: any) => f.name === "preview_food_log",
        ).parametersJsonSchema.required,
      ).not.toContain("days");
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
      if (sent.generationConfig.responseJsonSchema)
        expect(
          sent.generationConfig.responseJsonSchema.properties,
        ).not.toHaveProperty("days");
      else
        expect(sent.generationConfig).not.toHaveProperty("responseJsonSchema");
      expect(sent.contents.at(-1).parts.at(-1).text).toBe("with 2 eggs");
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
test("unsupported tools retry a conversational reply on the same model without claiming an action", async () => {
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
        expect(
          payload.tools[0].functionDeclarations.find(
            (f: any) => f.name === "preview_food_log",
          ).name,
        ).toBe("preview_food_log");
        return new Response(
          JSON.stringify({
            error: { message: "Request contains an invalid argument" },
          }),
          { status: 400 },
        );
      }
      expect(payload.generationConfig).not.toHaveProperty("responseJsonSchema");
      expect(payload.generationConfig).not.toHaveProperty("responseMimeType");
      expect(payload).not.toHaveProperty("tools");
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "Your eggs and toast are about 230 kcal. Would you like to prepare a preview for confirmation?",
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
  expect(await r.json()).toMatchObject({
    kind: "message",
    foods: [],
    adjustments: [],
  });
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
test("temporary Gemini 503 retries once on the same model and returns a usable estimate", async () => {
  let calls = 0;
  const response = await handleApi(
    request({
      message: "I ate 2 boiled eggs",
      context: { profile: { meals: 3 } },
    }),
    { NUDGE_GEMINI_API_KEY: "test-key", NUDGE_GEMINI_MODEL: "gemini-example" },
    async (url: string) => {
      expect(url).toContain("gemini-example:generateContent");
      if (++calls === 1)
        return new Response(
          JSON.stringify({ error: { message: "Model busy" } }),
          { status: 503 },
        );
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      kind: "log",
                      message: "Estimate",
                      foods: [
                        {
                          name: "Boiled eggs",
                          portion: "2 large eggs",
                          calories: 156,
                          protein: 12.6,
                          fibre: 0,
                          assumptions: "No added fat",
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
  expect(response.status).toBe(200);
});
test("persistent Gemini 503 stops after one retry with a redacted provider reason", async () => {
  let calls = 0;
  const response = await handleApi(
    request(),
    { NUDGE_GEMINI_API_KEY: "private-key" },
    async () => {
      calls++;
      return new Response(
        JSON.stringify({ error: { message: "High demand private-key" } }),
        { status: 503 },
      );
    },
  );
  expect(calls).toBe(2);
  expect(response.status).toBe(502);
  const body = await response.json();
  expect(body.error).toContain("High demand");
  expect(body.error).toContain("automatic retry");
  expect(body.error).not.toContain("private-key");
});
test("Hinglish greetings get a real conversational reply without a nutrition schema", async () => {
  const r = await handleApi(
    request({
      message: "kya haal hai?",
      context: { profile: { meals: 3 }, history: [] },
    }),
    { NUDGE_GEMINI_API_KEY: "test-key" },
    async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      expect(payload.generationConfig).not.toHaveProperty("responseJsonSchema");
      expect(payload.generationConfig).not.toHaveProperty("responseMimeType");
      expect(payload.systemInstruction.parts[0].text).toContain(
        "Reply naturally",
      );
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  { text: "Main theek hoon! Tumhara din kaisa ja raha hai?" },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  expect(r.status).toBe(200);
  const reply = await r.json();
  expect(reply.message).toContain("Main theek");
  expect(reply.kind).toBe("message");
  expect(reply.foods).toEqual([]);
});
test("a mislabeled craving gets a provider correction before exposing an adjustment", async () => {
  let calls = 0;
  const meal = {
    slot: "Dinner",
    name: "Dal and roti",
    portion: "1 katori dal, 1 roti",
    ingredients: ["lentils", "wheat"],
    calories: 350,
    protein: 15,
    fibre: 7,
    assumptions: "1 tsp oil included",
  };
  const response = await handleApi(
    request({
      message: "I'm craving one samosa, adjust dinner",
      context: {
        today: "2026-10-08",
        weekday: "Thu",
        profile: { meals: 3, diet: "vegetarian" },
        plan: [{ day: "Thu", meals: [meal] }],
      },
    }),
    { NUDGE_GEMINI_API_KEY: "test-key" },
    async (_url: string, init: RequestInit) => {
      calls++;
      if (calls === 2)
        expect(
          JSON.parse(init.body as string).generationConfig,
        ).not.toHaveProperty("responseJsonSchema");
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      kind: "adjustment",
                      message: "A samosa can fit with this proposed dinner",
                      foods: [
                        {
                          name: calls === 1 ? "Breakfast" : "Samosa",
                          portion:
                            calls === 1 ? "Breakfast" : "1 medium fried samosa",
                          calories: 250,
                          protein: 5,
                          fibre: 3,
                          assumptions: "Typical recipe estimate",
                        },
                      ],
                      adjustments: [{ day: "Thu", meal }],
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
  expect(response.status).toBe(200);
  expect((await response.json()).foods[0].name).toBe("Samosa");
});
test("meal advice and short food choices remain conversation without logging or changing meals", async () => {
  for (const message of [
    "lunch mein kya khau?",
    "now what can i have for lunch?",
    "chicken curry",
  ]) {
    const r = await handleApi(
      request({
        message,
        context: {
          profile: { meals: 3, diet: "non-vegetarian" },
          eaten: 490,
          remaining: 1010,
          history: [
            { role: "user", text: "now what can i have for lunch?" },
            {
              role: "assistant",
              text: "For lunch, would you prefer chicken curry or dal with 2 rotis?",
            },
          ],
        },
      }),
      { NUDGE_GEMINI_API_KEY: "test-key" },
      async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(init.body as string);
        expect(payload.generationConfig).not.toHaveProperty(
          "responseJsonSchema",
        );
        expect(payload.generationConfig).not.toHaveProperty("responseMimeType");
        expect(payload.systemInstruction.parts[0].text).toContain(
          "not a report of consumption",
        );
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "Try 1 katori chicken curry and 2 rotis, around 450 kcal depending on oil. Shall we review the remaining meals?",
                    },
                  ],
                },
              },
            ],
          }),
        );
      },
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      kind: "message",
      foods: [],
      days: [],
      adjustments: [],
    });
  }
});
test("actual consumption after lunch advice still requests a validated food preview", async () => {
  const r = await handleApi(
    request({
      message: "I ate chicken curry",
      context: {
        profile: { meals: 3 },
        history: [
          { role: "user", text: "what should I have for lunch?" },
          { role: "assistant", text: "For lunch try chicken curry." },
        ],
      },
    }),
    { NUDGE_GEMINI_API_KEY: "test-key" },
    async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      expect(payload.generationConfig).not.toHaveProperty("responseMimeType");
      expect(
        payload.tools[0].functionDeclarations.find(
          (f: any) => f.name === "preview_food_log",
        ).name,
      ).toBe("preview_food_log");
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      kind: "message",
                      message: "How much curry did you eat?",
                      foods: [],
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
  expect(r.status).toBe(200);
  expect((await r.json()).message).toBe("How much curry did you eat?");
});
test("a post-log review requires both requested slots and never proposes logging the food again", async () => {
  for (const slots of [["Lunch", "Dinner"], ["Lunch"]]) {
    const meals = ["Lunch", "Dinner"].map((slot) => ({
      slot,
      name: `${slot} dal`,
      portion: "1 bowl",
      ingredients: ["lentils"],
      calories: 400,
      protein: 15,
      fibre: 8,
      assumptions: "Estimate",
    }));
    const r = await handleApi(
      request({
        operation: "adjustment",
        message: "Review remaining meals",
        context: {
          today: "2026-10-08",
          weekday: "Thu",
          adjustmentSlots: ["Lunch", "Dinner"],
          profile: { meals: 3 },
          plan: [{ day: "Thu", meals }],
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
                        message: "Review",
                        foods: [{ name: "Already logged samosa" }],
                        adjustments: meals
                          .filter((m) => slots.includes(m.slot))
                          .map((meal) => ({ day: "Thu", meal })),
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        ),
    );
    expect(r.status).toBe(slots.length === 2 ? 200 : 502);
    if (r.status === 200) expect((await r.json()).foods).toEqual([]);
  }
});

test("a brownie craving without a portion gets conversation without food logging or a schema", async () => {
  for (const message of [
    "i want to eat a chocolate browine",
    "i want to eat a chocolate brownie",
  ]) {
    const r = await handleApi(
      request({
        message,
        context: {
          profile: { meals: 3 },
          remaining: 790,
          foodLogs: [],
          history: [],
        },
      }),
      { NUDGE_GEMINI_API_KEY: "test-key" },
      async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(init.body as string);
        expect(payload.generationConfig).not.toHaveProperty(
          "responseJsonSchema",
        );
        expect(payload.generationConfig).not.toHaveProperty("responseMimeType");
        expect(payload.systemInstruction.parts[0].text).toContain(
          "not reporting that they ate it",
        );
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "A typical brownie is roughly 200–350 kcal. What size or weight are you considering? Nothing is logged yet.",
                    },
                  ],
                },
              },
            ],
          }),
        );
      },
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      kind: "message",
      foods: [],
      days: [],
      adjustments: [],
    });
  }
});

test("one conversational interface handles a complete craving, portion, consumption and correction dialogue", async () => {
  const history: { role: string; text: string }[] = [];
  const food = {
    name: "Chocolate brownie",
    portion: "1 small homemade square (40 g)",
    calories: 180,
    protein: 3,
    fibre: 1,
    assumptions: "Recipe estimate including butter; no frosting",
  };
  const turns = [
    {
      message: "yaar aaj bahut thak gayi",
      reply: "Long day? We can keep food simple. What would feel good?",
    },
    {
      message: "something chocolatey",
      reply:
        "A brownie or a few squares of chocolate could work. Which sounds good?",
    },
    { message: "brownie", reply: "What size piece are you thinking of?" },
    {
      message: "one small homemade square",
      reply:
        "A 40 g homemade square might be around 180 kcal. This is only a craving discussion until you eat it.",
    },
    {
      message: "okay i ate it",
      reply:
        "Here’s a preview of that small homemade brownie. Confirm it to add it to your food log.",
      food,
    },
    {
      message: "actually half of that",
      reply: "Updated preview for half the brownie, not a second entry.",
      food: {
        ...food,
        portion: "Half a small square (20 g)",
        calories: 90,
        protein: 1.5,
        fibre: 0.5,
      },
    },
  ];
  let currentPreview: unknown;
  for (const turn of turns) {
    const response = await handleApi(
      request({
        operation: "chat",
        message: turn.message,
        context: {
          profile: { meals: 3, diet: "non-vegetarian" },
          remaining: 790,
          history,
          currentPreview,
        },
      }),
      { NUDGE_GEMINI_API_KEY: "test" },
      async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(init.body as string);
        expect(payload.generationConfig).not.toHaveProperty(
          "responseJsonSchema",
        );
        expect(payload.generationConfig).not.toHaveProperty("responseMimeType");
        expect(payload.toolConfig.functionCallingConfig.mode).toBe("AUTO");
        expect(payload.contents.at(-1).parts.at(-1).text).toBe(turn.message);
        expect(
          payload.contents.slice(0, -1).map((c: any) => c.parts[0].text),
        ).toEqual(history.map((h) => h.text));
        const part = turn.food
          ? {
              functionCall: {
                name: "preview_food_log",
                args: {
                  message: turn.reply,
                  consumptionEvidence: "okay i ate it",
                  foods: [turn.food],
                },
              },
            }
          : { text: turn.reply };
        return new Response(
          JSON.stringify({
            candidates: [{ finishReason: "STOP", content: { parts: [part] } }],
          }),
        );
      },
    );
    expect(response.status).toBe(200);
    const reply = await response.json();
    expect(reply.message).toBe(turn.reply);
    expect(reply.kind).toBe(turn.food ? "log" : "message");
    expect(reply.foods).toEqual(turn.food ? [turn.food] : []);
    expect(reply.days).toEqual([]);
    if (turn.food) currentPreview = reply;
    history.push(
      { role: "user", text: turn.message },
      { role: "assistant", text: reply.message },
    );
  }
});

test("a malformed optional action falls back to a real model clarification instead of breaking chat", async () => {
  let calls = 0;
  const response = await handleApi(
    request({
      operation: "chat",
      message: "I had a bowl of dal",
      context: { profile: { meals: 3 } },
    }),
    { NUDGE_GEMINI_API_KEY: "test" },
    async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      calls++;
      if (calls === 1)
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "preview_food_log",
                        args: {
                          message: "Dal preview",
                          consumptionEvidence: "I had a bowl of dal",
                          foods: [
                            {
                              name: "Dal",
                              portion: "1 bowl",
                              calories: -5,
                              protein: 12,
                              fibre: 5,
                              assumptions: "Unknown bowl size",
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }),
        );
      expect(payload.toolConfig.functionCallingConfig.mode).toBe("NONE");
      expect(payload.systemInstruction.parts[0].text).toContain(
        "previous action could not be validated",
      );
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "Was that a small katori or a large bowl, and was there a tadka?",
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
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    kind: "message",
    message: "Was that a small katori or a large bowl, and was there a tadka?",
    foods: [],
    adjustments: [],
  });
});

test("optional meal changes are validated separately from ordinary conversation", async () => {
  const original = {
    slot: "Dinner",
    name: "Dal and roti",
    portion: "1 katori dal, 2 rotis",
    ingredients: ["lentils", "wheat"],
    calories: 500,
    protein: 18,
    fibre: 8,
    assumptions: "1 tsp oil",
  };
  const replacement = {
    ...original,
    portion: "1 katori dal, 1 roti, 1 bowl sabzi",
    calories: 420,
  };
  const response = await handleApi(
    request({
      operation: "chat",
      message: "Can we change dinner now?",
      context: {
        profile: { meals: 3, diet: "vegetarian" },
        today: "2026-10-08",
        weekday: "Thu",
        foodLogs: [{ name: "Brownie", calories: 180 }],
        plan: [{ day: "Thu", meals: [original] }],
      },
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
                      name: "propose_meal_adjustment",
                      args: {
                        message:
                          "Here is an optional dinner change for your approval.",
                        foods: [],
                        adjustments: [{ day: "Thu", meal: replacement }],
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
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    kind: "adjustment",
    foods: [],
    adjustments: [{ day: "Thu", meal: replacement }],
  });
});

test("a food choice cannot become a log preview using fabricated consumption evidence", async () => {
  let calls = 0;
  const r = await handleApi(
    request({
      operation: "chat",
      message: "brownie",
      context: {
        profile: { meals: 3 },
        history: [{ role: "user", text: "something chocolatey sounds good" }],
      },
    }),
    { NUDGE_GEMINI_API_KEY: "test" },
    async () => {
      calls++;
      const part =
        calls === 1
          ? {
              functionCall: {
                name: "preview_food_log",
                args: {
                  message: "Brownie preview",
                  consumptionEvidence: "I ate a brownie",
                  foods: [
                    {
                      name: "Brownie",
                      portion: "40 g",
                      calories: 180,
                      protein: 3,
                      fibre: 1,
                      assumptions: "Recipe estimate",
                    },
                  ],
                },
              },
            }
          : {
              text: "What size brownie are you thinking of? We’re just discussing it; nothing is logged.",
            };
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [part] } }] }),
      );
    },
  );
  expect(calls).toBe(2);
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ kind: "message", foods: [] });
});

const fourMealWeek = () => ({
  message: "Your draft is ready for review.",
  kind: "plan",
  foods: [],
  days: Object.fromEntries(
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => [
      day,
      {
        meals: Object.fromEntries(
          ["Breakfast", "Lunch", "Snacks", "Dinner"].map((slot) => [
            slot,
            {
              name: `${day} ${slot} dal and rice`,
              portion: "1 katori (150 g cooked)",
              ingredients: ["dal", "rice", "5 ml oil"],
              calories: 350,
              protein: 12,
              fibre: 5,
              assumptions: "Estimated cooked portions including oil.",
            },
          ]),
        ),
      },
    ]),
  ),
});
test("four-meal weekly drafts accept a complete fenced JSON document", async () => {
  const response = await handleApi(
    request({
      operation: "menu",
      message: "Create my weekly draft",
      context: { profile: { meals: 4 } },
    }),
    { NUDGE_GEMINI_API_KEY: "test" },
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text:
                      "```json\n" + JSON.stringify(fourMealWeek()) + "\n```",
                  },
                ],
              },
            },
          ],
        }),
      ),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.days).toHaveLength(7);
  expect(
    result.days.every(
      (day: any) =>
        day.meals.map((meal: any) => meal.slot).join(",") ===
        "Breakfast,Lunch,Snacks,Dinner",
    ),
  ).toBe(true);
});
test("malformed four-meal drafts are regenerated once with the complete schema", async () => {
  let attempts = 0;
  const response = await handleApi(
    request({
      operation: "menu",
      message: "Create my weekly draft",
      context: { profile: { meals: 4 } },
    }),
    { NUDGE_GEMINI_API_KEY: "test" },
    async (_url: string, options: any) => {
      attempts++;
      const payload = JSON.parse(options.body);
      expect(
        payload.generationConfig.responseJsonSchema.properties.days.required,
      ).toHaveLength(7);
      if (attempts === 2)
        expect(payload.systemInstruction.parts[0].text).toContain(
          "Generate the entire draft afresh",
        );
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text:
                      attempts === 1
                        ? '{"kind":"plan",'
                        : JSON.stringify(fourMealWeek()),
                  },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  expect(attempts).toBe(2);
  expect(response.status).toBe(200);
  expect(
    (await response.json()).days.flatMap((day: any) => day.meals),
  ).toHaveLength(28);
});
test("repeated malformed weekly output never returns a partial draft", async () => {
  let attempts = 0;
  const response = await handleApi(
    request({
      operation: "menu",
      message: "Create my weekly draft",
      context: { profile: { meals: 4 } },
    }),
    { NUDGE_GEMINI_API_KEY: "test" },
    async () => {
      attempts++;
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"kind":"plan",' }] } }],
        }),
      );
    },
  );
  expect(attempts).toBe(2);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    error: expect.stringContaining("saved plan is unchanged"),
  });
});

test("approved menu consumption resolves exact dishes and nutrition instead of AI estimates", async () => {
  const planned = {
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
  const response = await handleApi(
    request({
      operation: "chat",
      message: "Approved Thursday meals",
      context: {
        profile: { meals: 4 },
        weekday: "Thu",
        plan: [],
        approvedMenu: [
          {
            day: "Thu",
            meals: [
              planned,
              { ...planned, slot: "Lunch", name: "Rajma rice", calories: 450 },
            ],
          },
        ],
        history: [
          { role: "user", text: "I ate my planned breakfast and lunch" },
        ],
        foodLogs: [],
      },
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
                          "Here are your approved breakfast and lunch. Confirm to log them.",
                        consumptionEvidence:
                          "I ate my planned breakfast and lunch",
                        day: "Thu",
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
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.kind).toBe("log");
  expect(
    result.foods.map((f: any) => [f.name, f.calories, f.menuDay, f.menuSlot]),
  ).toEqual([
    ["Poha", 310, "Thu", "Breakfast"],
    ["Rajma rice", 450, "Thu", "Lunch"],
  ]);
});
test.each(["unapproved", "already logged"])(
  "menu log tool refuses %s meals",
  async (mode) => {
    let calls = 0;
    const meal = {
      slot: "Breakfast",
      name: "Poha",
      portion: "1 bowl",
      ingredients: ["rice"],
      calories: 300,
      protein: 6,
      fibre: 3,
      assumptions: "Estimate",
      approved: mode !== "unapproved",
    };
    const response = await handleApi(
      request({
        operation: "chat",
        message: "I ate my menu breakfast",
        context: {
          profile: { meals: 3 },
          approvedMenu: [{ day: "Thu", meals: [meal] }],
          foodLogs:
            mode === "already logged"
              ? [{ menuDay: "Thu", menuSlot: "Breakfast" }]
              : [],
        },
      }),
      { NUDGE_GEMINI_API_KEY: "test" },
      async () => {
        calls++;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    calls === 1
                      ? {
                          functionCall: {
                            name: "preview_menu_log",
                            args: {
                              message: "Preview",
                              consumptionEvidence: "I ate my menu breakfast",
                              day: "Thu",
                              slots: ["Breakfast"],
                            },
                          },
                        }
                      : { text: "Could you clarify the meal you ate?" },
                  ],
                },
              },
            ],
          }),
        );
      },
    );
    expect(calls).toBe(2);
    expect(response.status).toBe(200);
    expect((await response.json()).foods).toEqual([]);
  },
);
