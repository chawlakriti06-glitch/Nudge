import http from "node:http";
import { handleApi } from "./api.mjs";
const server = http.createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(name, Array.isArray(value) ? value.join(",") : value);
    }
    const options = { method: req.method, headers };
    if (!["GET", "HEAD"].includes(req.method)) {
      options.body = req;
      options.duplex = "half";
    }
    const result = await handleApi(
      new Request(`http://127.0.0.1${req.url}`, options),
    );
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(await result.text());
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "API request failed. Saved data is unchanged." }),
    );
  }
});
server.listen(Number(process.env.PORT) || 3001, "127.0.0.1", () =>
  console.log(
    "Nudge API listening on loopback. Request payloads are not logged.",
  ),
);
