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

## AI configuration

Set server-only `NUDGE_API_KEY` and `NUDGE_MODEL`. Select a currently available OpenAI model in your account that supports Responses API Structured Outputs. No model is silently substituted. `.env.example` contains placeholders only; `.env` is ignored. Never use `VITE_` for secrets. `npm run server` uses `--use-env-proxy` so cloud HTTPS proxy configuration is respected.

Allow `api.openai.com` for live calls, `developers.openai.com` and `platform.openai.com` for documentation, and `pubmed.ncbi.nlm.nih.gov` for primary estimation documentation. Draft network changes are saved but require activation through environment settings. API key/model were absent in this instance: live provider responses are **not tested**. Missing credentials return HTTP 503; manual food logging, ledger editing, local memory and profile controls remain usable. No scripted conversation or generated placeholder menu is presented as AI.

Implementation consulted the current official OpenAI Node SDK Responses API definitions at https://github.com/openai/openai-node/blob/master/src/resources/responses/responses.ts (Structured Outputs `text.format`, `json_schema`, `strict`, and `store:false`). The hosted documentation pages remain blocked by the current network policy. Read them and perform a live call after enabling the listed domains. The server keeps its key in environment variables, does not persist payloads or log routine request bodies, and requests provider storage be disabled. Only relevant food preferences, budget, plan, today's totals and six recent messages are sent; name and measurements are omitted. The frontend validates all outputs before any proposal is shown. It calculates consumed totals itself.

## Budgets and nutrition

Manual budgets do not require age or sex. The optional adult estimate implements Mifflin–St Jeor resting energy: `10 × kg + 6.25 × cm − 5 × age + 5` (male coefficient) or `−161` (female coefficient). Original study: Mifflin et al., *American Journal of Clinical Nutrition* 1990, DOI `10.1093/ajcn/51.2.241`, PMID `2305711`, https://pubmed.ncbi.nlm.nih.gov/2305711/. Approximate activity factors (1.2, 1.55, 1.725) are explicitly identified as assumptions. Maintenance and goal targets are separate. Optional ±250 kcal goal changes require acceptance. Age under 18 is refused; pregnancy/special-circumstance selection directs users to manual entry.

The formula arithmetic is tested. **Direct verification against the primary paper remains blocked by the environment network policy**; verify its coefficients against the linked paper when access is enabled before relying on the estimation workflow. This is not a clinical suitability assessment.

Nutrition amounts are estimates, with user-entered label/source notes or AI-visible assumptions. There is no authoritative nutrition database integration in this version. AI is instructed to cite documented data when available, include oil and raw/cooked weight assumptions, and ask about material portion ambiguity. Generated estimates require confirmation. Known ingredient conflicts, common allergen aliases and vegetarian/vegan exclusions are checked locally on generation, swaps, edits and week approval. This is not exhaustive allergen detection or a cross-contact guarantee; label and preparation checks remain necessary.

## Local data

Profile, logs, chats, saved plans and unconfirmed proposals use durable browser localStorage under `nudge.local.v1`. There is no login, database or sync. Dates use the user's local timezone. Approval never counts as intake, and steps never change food budget. Reload retains data; clearing browser storage removes it. Delete my data clears Nudge only, preserving Trace's separate keys. Privacy information in the app explains relevant context transmission for online AI and browser speech services. Speech recognition is used only if available and permitted; typing is the fallback, never a demo recording.

## Verify

```sh
npm run build
npm test
npm run test:browser
```

Browser tests use `/usr/bin/chromium`; adjust the test runner's executable path for another machine. Unit tests cover totals by day, adult formula arithmetic, three/four-slot completeness, dietary conflicts and malformed output. Browser tests exercise manual/estimated budgets, retained welcome food, confirmed intake, editing/deletion, reload, pause/resume, delete data, menu approval and revision separation, allergy rejection, AI errors, durable previews, and phone-width clipping. AI fixtures in tests are explicitly fixtures; they are not live AI validation. Real dictation/provider access and primary-paper retrieval require external setup.

## Netlify frontend setup

Connect this repository, leave the base directory blank, use `npm run build`, and publish `dist`. Set Node.js to 24. The included configuration supplies these defaults. The AI endpoint runs as the included Netlify Function (`netlify/functions/api.mjs`), sharing the same handler as the local Node server. `/api/*` routes to this function before the SPA fallback. In Netlify environment settings, add `NUDGE_API_KEY` and `NUDGE_MODEL` for the Functions runtime, then redeploy. Choose a current model available to your OpenAI account with Structured Outputs support. These variables stay on the server; API billing/access must also be enabled. Without them, the function returns a readable setup message and manual logging stays available. Do not add credentials to build-time frontend variables.
