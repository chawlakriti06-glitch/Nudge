import { test, expect } from "vitest";
// @ts-expect-error standalone JavaScript function
import status from "../api/status.js";
// @ts-expect-error standalone JavaScript function
import chat from "../api/chat.js";
import config from "../vercel.json";
function response() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    text: "",
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    end(s: string) {
      this.text = s;
    },
  };
}
test("Vercel status runs through the shared API without revealing secrets", async () => {
  const res = response();
  await status({ method: "GET" }, res);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.text)).toHaveProperty("configured");
  expect(JSON.parse(res.text)).not.toHaveProperty("key");
  expect(res.headers["cache-control"]).toBe("no-store");
});
test("Vercel parsed JSON requests preserve method and return JSON setup fallback", async () => {
  const saved = process.env.NUDGE_GEMINI_API_KEY;
  delete process.env.NUDGE_GEMINI_API_KEY;
  try {
    const res = response();
    await chat(
      {
        method: "POST",
        body: { message: "Menu", context: { profile: { meals: 3 } } },
      },
      res,
    );
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.text).error).toContain("NUDGE_GEMINI_API_KEY");
  } finally {
    if (saved === undefined) delete process.env.NUDGE_GEMINI_API_KEY;
    else process.env.NUDGE_GEMINI_API_KEY = saved;
  }
});
test("SPA rewrite excludes API routes", () => {
  const pattern = new RegExp(`^${config.rewrites[0].source}$`);
  expect(pattern.test("/profile")).toBe(true);
  expect(pattern.test("/")).toBe(true);
  for (const path of ["/api/chat", "/api/status", "/api/models"])
    expect(pattern.test(path)).toBe(false);
});
