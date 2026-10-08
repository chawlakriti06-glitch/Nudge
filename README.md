# Nudge

A standalone mobile-first React / TypeScript / Vite app. Originally developed separately from Trace in Mosaic; this repository contains Nudge only. Nudge uses navy, orange and ivory screens based on the supplied six-screen wireframe, without food photographs.

## Run

Requires Node.js **24+** (the server uses Node's supported environment-proxy flag), npm, and Chromium for the browser tests.

```sh
cd /workspace/nudge
npm ci
cp .env.example .env
# Edit .env securely; never put credentials in chat or frontend variables.
npm run server
```

In a second terminal in the same directory:

```sh
npm run dev -- --strictPort
```

The web app runs on port 5174; Vite proxies `/api` to the loopback API on port 3001. This standalone app has no dependency on Trace or Mosaic. For a production build, run `npm run build`; other production hosting must route `/api` to the Node server; Netlify uses the included function. Static hosting alone cannot run AI. No public deployment was performed.

## Gemini AI configuration (free-tier setup)

The app now uses Google's Gemini API only. There is no OpenAI call or automatic paid-provider fallback. Create a key at https://aistudio.google.com/apikey for a project shown as **Free tier**. Do not enable billing or upgrade that project if you want to avoid paid API usage. Free-tier eligibility, available models and quotas depend on Google's current rules and your region. Hosting limits are separate.

Set server-only `NUDGE_GEMINI_API_KEY`. Optional `NUDGE_GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`; verify that this model is currently available on your project's free tier, or select another compatible free-tier Gemini model supporting structured JSON output. Old `NUDGE_API_KEY` / `NUDGE_MODEL` variables are ignored, so an OpenAI key is never sent to Google. You may remove the old variables from Netlify. `.env.example` contains placeholders only and `.env` is ignored. Never use `VITE_` prefixes for keys.

For Netlify: open Environment variables, add `NUDGE_GEMINI_API_KEY` with a Production value, mark it secret, and include the Functions scope (All scopes is also compatible). Optionally add `NUDGE_GEMINI_MODEL`. Save and trigger a production redeploy. Refresh Nudge and request a weekly menu. A missing key returns a clear setup error; a 429 explains the free-tier limit and keeps manual logging available. The code does not upgrade billing or switch providers.

For local development use the same variable names in `.env`, then `npm run server`. Node's supported `--use-env-proxy` flag respects cloud HTTPS proxy configuration. Required API destination: `generativelanguage.googleapis.com`; setup/docs destinations: `aistudio.google.com` and `ai.google.dev`. The official Google SDK documentation/source was consulted at https://github.com/googleapis/python-genai and https://github.com/googleapis/js-genai (generateContent, systemInstruction, responseMimeType and responseJsonSchema). The hosted documentation/pricing pages returned 403 in this environment; current free-tier details must be checked in Google AI Studio. Relevant docs: https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/structured-output.

No Gemini key was available here, so live Gemini responses are **not tested**. Tests use explicit provider fixtures. The key stays server-side, outside browser bundles and request URLs; our server does not persist payloads or routinely log request bodies. Only relevant preferences, budget, current plan, today's totals and six recent messages are sent; name and measurements are omitted. Google processes this context under its API terms. Free-tier submissions may be used to improve Google's products: review the terms and avoid sensitive information. The frontend validates outputs before showing proposals and calculates consumed totals itself.

## Budgets and nutrition

Manual budgets do not require age or sex. The optional adult estimate implements Mifflin–St Jeor resting energy: `10 × kg + 6.25 × cm − 5 × age + 5` (male coefficient) or `−161` (female coefficient). Original study: Mifflin et al., *American Journal of Clinical Nutrition* 1990, DOI `10.1093/ajcn/51.2.241`, PMID `2305711`, https://pubmed.ncbi.nlm.nih.gov/2305711/. Approximate activity factors (1.2, 1.55, 1.725) are explicitly identified as assumptions. Maintenance and goal targets are separate. Optional ±250 kcal goal changes require acceptance. Age under 18 is refused; pregnancy/special-circumstance selection directs users to manual entry.

The formula arithmetic is tested. **Direct verification against the primary paper remains blocked by the environment network policy**; verify its coefficients against the linked paper when access is enabled before relying on the estimation workflow. This is not a clinical suitability assessment.

Nutrition amounts are estimates, with user-entered label/source notes or AI-visible assumptions. There is no authoritative nutrition database integration in this version. AI is instructed to cite documented data when available, include oil and raw/cooked weight assumptions, and ask about material portion ambiguity. Generated estimates require confirmation. Known ingredient conflicts, common allergen aliases and vegetarian/vegan exclusions are checked locally on generation, swaps, edits and week approval. This is not exhaustive allergen detection or a cross-contact guarantee; label and preparation checks remain necessary.

## Local data

Profile, logs, chats, saved plans and unconfirmed proposals use durable browser localStorage under `nudge.local.v1`. There is no login, database or sync. Dates use the user's local timezone. Approval never counts as intake. The home screen shows calories, protein and fibre from confirmed food logs, with editable protein/fibre targets. Older logs with missing nutrient values are marked incomplete rather than treated as known zero. Reload retains data; clearing browser storage removes it. Delete my data clears Nudge only, preserving Trace's separate keys. Privacy information in the app explains relevant context transmission for online AI and browser speech services. Speech recognition is used only if available and permitted; typing is the fallback, never a demo recording.

## Verify

```sh
npm run build
npm test
npm run test:browser
```

Browser tests use `/usr/bin/chromium`; adjust the test runner's executable path for another machine. Unit tests cover totals by day, adult formula arithmetic, three/four-slot completeness, dietary conflicts and malformed output. Browser tests exercise manual/estimated budgets, retained welcome food, confirmed intake, editing/deletion, reload, pause/resume, delete data, menu approval and revision separation, allergy rejection, AI errors, durable previews, and phone-width clipping. AI fixtures in tests are explicitly fixtures; they are not live AI validation. Real dictation/provider access and primary-paper retrieval require external setup.

## Netlify deployment

Connect this repository, leave the base directory blank, use `npm run build`, and publish `dist`. Set Node.js to 24. The included configuration supplies these defaults. `netlify/functions/api.mjs` shares the local server handler, and `/api/*` routes to the function before the SPA fallback. Follow the Gemini configuration section above, then redeploy. No database or account migration is needed; existing browser data is preserved.

## Vercel deployment

This repository now includes Vercel Node API functions in `api/` for `/api/chat`, `/api/status` and `/api/models`. They use the same Gemini handler as local development and Netlify. `vercel.json` configures the Vite build, `dist` output, function duration, and SPA fallback that excludes API routes. Node.js is pinned to 24.x. Netlify files are retained so the previous site need not be altered.

1. In Vercel, choose Add New → Project and import `chawlakriti06-glitch/Nudge` from GitHub. Choose Vite and leave Root Directory at the repository root. Build command is `npm run build`; Output Directory is `dist`.
2. Add `NUDGE_GEMINI_API_KEY` securely to the Production environment. Copy your Google AI Studio key directly into Vercel; never paste it in chat. Set `NUDGE_GEMINI_MODEL` to `gemini-3.5-flash-lite`, as recommended by Google's response for new users. Keep Google billing disabled and check that your project has free-tier quota for this model. No paid fallback is used.
3. Deploy. Open `/api/status` on the new site to verify configuration presence, then request a weekly menu to test live provider access. A configured flag alone does not prove a successful AI call.
4. Keep your old Netlify site until you are satisfied with the Vercel deployment. A different site address has separate browser localStorage: existing Netlify data does **not** automatically appear on Vercel. Do not delete the old site's browser data.

The migration configuration was tested locally; Vercel account access, production deployment and live Gemini calls still require user setup. Free hosting has limits and eligibility rules; check Vercel's current Hobby-plan terms before publishing. A Hobby deployment does not require a paid upgrade for this configuration.


### Conversational intake and cravings

Chat sends the confirmed logs for the local day, approved menu, remaining calories, nutrient totals, recent conversation and current preview to Gemini. Actual consumption returns a preview; confirmation alone adds it to the ledger. A craving can return one proposed replacement for today's dinner with Approve/Reject. Approval changes only that meal; a separate “I ate it” confirmation logs the craving. Proposals from a different date or with changed intake/menu are rejected. Manual logging, editing, deletion and undo update all three indicators.

Gemini schema errors receive one retry using JSON mode on the same configured model, with output validation retained. Free-tier rate limits are not retried with a paid provider. Network, quota and provider availability errors still need a connected, configured provider; manual logging remains available. Test fixtures do not establish live-provider availability.
