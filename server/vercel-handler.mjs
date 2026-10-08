import { handleApi } from "./api.mjs";
// Vercel parses JSON bodies before calling a Node function. Rebuild a Web
// Request for the same provider handler used by local development and Netlify.
export async function handleVercel(req, res, path) {
  try {
    const method = req.method || "GET";
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (!["GET", "HEAD"].includes(method))
      options.body =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? null);
    const result = await handleApi(
      new Request(`https://nudge.invalid${path}`, options),
    );
    res.statusCode = result.status;
    result.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(await result.text());
  } catch {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        error:
          "API request failed. Your saved data is unchanged. Manual logging still works.",
      }),
    );
  }
}
