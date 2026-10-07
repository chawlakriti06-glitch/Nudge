import { test, expect } from "vitest";
import { readApiJson } from "../src/api";
// JS handler is also the actual Netlify entry point.
// @ts-expect-error standalone JavaScript module
import handler from "../netlify/functions/api.mjs";
// @ts-expect-error standalone JavaScript module
import { handleApi } from "../server/api.mjs";
const request = (body: unknown = { message: "Generate a menu", context: {} }) =>
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
  ).rejects.toThrow("Netlify Function");
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
    key: process.env.NUDGE_API_KEY,
    model: process.env.NUDGE_MODEL,
  };
  delete process.env.NUDGE_API_KEY;
  delete process.env.NUDGE_MODEL;
  try {
    const status = await handler(
      new Request("https://nudge.example/.netlify/functions/api/status"),
    );
    expect(await status.json()).toEqual({ configured: false });
    const r = await handler(request());
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain("NUDGE_API_KEY");
  } finally {
    for (const [k, v] of [
      ["NUDGE_API_KEY", saved.key],
      ["NUDGE_MODEL", saved.model],
    ])
      if (v === undefined) delete process.env[k!];
      else process.env[k!] = v;
  }
});
test("provider call stays server-side and uses configurable model, mocked transport only", async () => {
  const env = {
    NUDGE_API_KEY: "test-only-placeholder",
    NUDGE_MODEL: "test-model",
  };
  const r = await handleApi(request(), env, async (url: string, opts: any) => {
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(opts.headers.Authorization).toBe("Bearer test-only-placeholder");
    expect(JSON.parse(opts.body)).toMatchObject({
      model: "test-model",
      store: false,
    });
    return new Response(
      JSON.stringify({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  message: "Test fixture",
                  kind: "message",
                  foods: [],
                  days: [],
                }),
              },
            ],
          },
        ],
      }),
    );
  });
  expect(r.status).toBe(200);
  expect((await r.json()).message).toBe("Test fixture");
});
test("invalid requests and provider failures return JSON without applying output", async () => {
  const env = { NUDGE_API_KEY: "test", NUDGE_MODEL: "test" };
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
