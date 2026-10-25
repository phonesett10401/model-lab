# Comic translator, plan 1 of 3: translate-and-letter page (hand-drawn boxes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working `/comic-translator` page where a visitor opens an image or PDF, draws boxes over the English, types the English, sends the page's text (never the image) to Gemini through our Vercel function, checks the reply, and downloads the page with the Burmese lettered in.

**Architecture:** Everything image-related runs in the browser. Pure logic (validation, check, reading order, wrapping and fitting, erase choice) lives in small TypeScript modules under `src/lib/comic/` with Vitest tests. A Vercel function `api/translate.ts` wraps one tested handler that talks to Gemini's REST API; a Vite dev middleware mounts the same handler for local work. The page (`layout B`) is one Svelte component; e2e tests replace `/api/translate` with `page.route`, so tests never call Gemini.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, adapter-static, Vercel Node function (web `Request`/`Response` signature), Gemini REST `generateContent`, `Intl.Segmenter('my')`, canvas 2D, `pdfjs-dist` (new), `@fontsource/noto-sans-myanmar` (new), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-comic-translator-design.md`

**Later plans (not here):** plan 2 = data, labelling and detector training (Apache-2.0/MIT detector); plan 3 = detector + OCR in this page, finished examples, report card, home link.

## Global Constraints

- Comic images never leave the browser. The function accepts text only; it never receives image data.
- `GEMINI_API_KEY` lives in `.env` (git-ignored) locally and in Vercel environment variables. Never print, log, commit or send it to the browser.
- Default model `gemini-3.5-flash`, set by `GEMINI_MODEL`; tier set by `GEMINI_TIER` (`free` | `paid`, default `free`).
- Free tier only for public-domain / openly licensed pages; the page says so while `GEMINI_TIER=free`.
- Burmese font: Noto Sans Myanmar (Unicode). Never Zawgyi.
- No invented numbers on the page.
- No `Co-Authored-By` or any Claude attribution in commits.
- Work on this branch only. Do not commit to `master`; ask the owner before any `git push`.
- Another session uses port 4173 for evaluations: **never** start a server on 4173 and never run `pnpm eval:assistant`. Run e2e with `E2E_PORT=4180` (added in Task 1).
- Lab rules: Light / Dark themes, no horizontal overflow at 375 px, nothing heavy loads before the visitor uses it (pdf.js loads only when a PDF is opened).

## Review Focus

1. **Gemini returns malformed or partial JSON** (code fences, missing numbers, extra numbers): the visitor sees red lines with retry, never a crash. Test in Task 2 (`parses fenced JSON`) and Task 3 (`flags missing and extra`).
2. **Quota reached (HTTP 429 from Gemini):** the page shows the exact "used up" message and keeps the visitor's boxes and text. Test in Task 7 (`quota keeps work`).
3. **A single Burmese "word" wider than the box** (long compound, no break points): wrap falls back to grapheme breaks, never splits a stacked character. Test in Task 4 (`breaks an overlong word by grapheme`).
4. **Huge or many-page PDF:** over 50 pages is refused with a message instead of freezing the tab. Test in Task 6 (`refuses over 50 pages`).
5. **Request from another site to our function:** rejected with 403 so the key can't be borrowed. Test in Task 2 (`rejects cross-origin`).

---

### Task 1: Key check, env template, e2e port

**Files:**
- Create: `.env.example`, `scripts/check-gemini.mjs`
- Modify: `playwright.config.ts` (port from `E2E_PORT`)

**Interfaces:**
- Produces: env names `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIER`; `E2E_PORT` for Playwright.

- [ ] **Step 1:** Create `.env.example` (committed; `.gitignore` already allows it):
  ```
  GEMINI_API_KEY=
  GEMINI_MODEL=gemini-3.5-flash
  GEMINI_TIER=free
  ```
  Tell the owner to add `GEMINI_TIER=free` to their own `.env` (do not open or edit `.env` yourself).
- [ ] **Step 2:** Write `scripts/check-gemini.mjs`, run as `node --env-file=.env scripts/check-gemini.mjs`. It GETs `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}` with header `x-goog-api-key`, and prints only: `key: present|missing`, `model: <name> available|not available (<HTTP status>)`. It must never print the key or the full response headers.
- [ ] **Step 3:** Run it. Expected: `key: present` and `model: gemini-3.5-flash available`. If not available on the free tier, report to the owner and propose the newest free Flash model; do not change the default without their yes.
- [ ] **Step 4:** In `playwright.config.ts`, read `const port = Number(process.env.E2E_PORT ?? 4173)` and use it for `webServer.command` (`--port ${port}`), `webServer.port` and `use.baseURL`. Existing behaviour without `E2E_PORT` is unchanged.
- [ ] **Step 5:** Verify: `$env:E2E_PORT=4180; pnpm exec playwright test e2e/smoke.e2e.ts --project chromium` passes, and nothing listens on 4173 from this run.
- [ ] **Step 6:** Commit `chore(comic): Gemini key check, env template, configurable e2e port`.

### Task 2: Translate handler (server side)

**Files:**
- Create: `src/lib/comic/types.ts`, `src/lib/comic/translate-server.ts`
- Test: `src/lib/comic/translate-server.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type RegionClass = 'bubble' | 'caption' | 'sfx' | 'art-text';
  export type Speaker = 'man' | 'woman' | 'child' | 'narrator' | 'unknown';
  export interface SentLine { n: number; text: string; cls: RegionClass; speaker: Speaker }
  export interface GotLine { n: number; text: string }
  export type TranslateReply =
    | { ok: true; lines: GotLine[]; model: string }
    | { ok: false; error: 'bad-request' | 'forbidden' | 'quota' | 'upstream' };
  export interface ServerEnv { key: string; model: string; tier: 'free' | 'paid' }
  ```
- Produces (`translate-server.ts`):
  - `LIMITS = { maxLines: 200, maxLineChars: 500, maxBodyBytes: 20_000 }`
  - `validateLines(body: unknown): SentLine[] | null`
  - `buildPrompt(lines: SentLine[]): { system: string; user: string }`
  - `parseGemini(json: unknown): GotLine[] | null`
  - `handleTranslate(req: Request, env: ServerEnv, fetchImpl?: typeof fetch): Promise<Response>`. `POST` → JSON `TranslateReply`; `GET` → `{ model, tier }`.

- [ ] **Step 1: Write failing tests** in `translate-server.test.ts` (fake `fetchImpl` records its call; requests built with `new Request('https://lab.test/api/translate', { method, headers: { origin, 'content-type': 'application/json' }, body })`):
  - `accepts numbered text lines`: `validateLines({ lines: [{ n: 1, text: 'HELLO', cls: 'bubble', speaker: 'man' }] })` returns that array.
  - `rejects images and unknown fields`: a body with `image: 'data:image/png;base64,...'`, a line with `cls: 'photo'`, `n` repeated, `text` of 501 chars, or 201 lines → `null`.
  - `rejects cross-origin`: origin `https://evil.test` → status 403, `{ ok: false, error: 'forbidden' }`, `fetchImpl` never called. A missing origin header → also 403.
  - `rejects oversized body`: a 20,001-byte body → 400 `bad-request`, no upstream call.
  - `sends text only to Gemini`: the upstream call goes to `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`, has header `x-goog-api-key: test-key`, `generationConfig.responseMimeType === 'application/json'`, and the serialized body contains `HELLO` and no `data:image`.
  - `prompt carries speaker and order`: `buildPrompt` user text lists lines in `n` order with `[man]` / `[sfx]` tags; system text mentions `ခင်ဗျာ` and `ရှင်` and asks for JSON `{"lines":[{"n":…,"text":…}]}` with the same numbers.
  - `parses fenced JSON`: upstream text "```json\n{\"lines\":[{\"n\":1,\"text\":\"မင်္ဂလာပါ\"}]}\n```" → `{ ok: true, lines: [{ n: 1, text: 'မင်္ဂလာပါ' }], model: 'gemini-3.5-flash' }`.
  - `maps quota`: upstream 429 → our status 429, `error: 'quota'`. Upstream 500 or unparseable text → 502 `upstream`.
  - `GET reports model and tier`: → `{ model: 'gemini-3.5-flash', tier: 'free' }`.
  - `never leaks the key`: in every response above, the body does not contain `test-key`.
- [ ] **Step 2:** Run `pnpm test:unit --run src/lib/comic/translate-server.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement. Origin rule: allowed only when `new URL(origin).host === new URL(req.url).host` (same site, so production, previews and local dev all work with no list). Prompt: natural spoken Burmese for comic readers; endings follow the speaker (polite male `ခင်ဗျာ`, female `ရှင်`, casual between friends); `sfx` as Burmese sound words; keep names; Unicode only, never Zawgyi; return exactly the same `n` values.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): text-only translate handler for Gemini`.

### Task 3: Vercel function, dev mount, client call and the check

**Files:**
- Create: `api/translate.ts`, `src/lib/comic/check.ts`, `src/lib/comic/client.ts`
- Modify: `vite.config.ts` (dev-only middleware plugin)
- Test: `src/lib/comic/check.test.ts`

**Interfaces:**
- Consumes: `handleTranslate`, `ServerEnv`, `SentLine`, `GotLine`, `TranslateReply` (Task 2).
- Produces:
  - `api/translate.ts`: `export function GET(req: Request)` and `export function POST(req: Request)`, both `handleTranslate(req, envFromProcess())`. Import with a relative path (`../src/lib/comic/translate-server`), not `$lib`.
  - `types.ts` (add): `export type LineProblem = 'missing' | 'not-burmese' | 'zawgyi' | 'length'`.
  - `check.ts`: `checkLines(sent: SentLine[], got: GotLine[]): { byN: Map<number, { text: string; problem: LineProblem | null }>; extra: number[] }`; `isZawgyiLikely(s: string): boolean`; `LENGTH_RATIO = { min: 0.3, max: 4 }`.
  - `client.ts`: `translatePage(lines: SentLine[], fetchImpl?: typeof fetch): Promise<TranslateReply>` (POST `/api/translate`; a network failure becomes `{ ok: false, error: 'upstream' }`); `serviceInfo(): Promise<{ model: string; tier: 'free' | 'paid' } | null>`.

- [ ] **Step 1: Write failing tests** in `check.test.ts`:
  - `ok when every line came back in Burmese`: sent n=1 "HELLO THERE", got n=1 "မင်္ဂလာပါ ခင်ဗျာ" → problem `null`, `extra` empty.
  - `flags missing and extra`: sent n=1,2, got n=2,3 → n=1 `missing`, `extra` `[3]`.
  - `flags not Burmese`: got "Hello" → `not-burmese` (fewer than half of the letters in U+1000–U+109F).
  - `flags Zawgyi`: `isZawgyiLikely('ေမာင္')` true (vowel sign E U+1031 before its consonant, and Zawgyi asat form U+1039 as killer); `isZawgyiLikely('မောင်')` false; the line gets `zawgyi`.
  - `flags odd length`: English 40 chars and Burmese 5 chars → `length`; English "OK" and Burmese "ရပြီ" → `null` (ratio rule applies only when English ≥ 10 chars).
- [ ] **Step 2:** Run `pnpm test:unit --run src/lib/comic/check.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `check.ts` and `client.ts`. Mark the Zawgyi rule `// ponytail: heuristic (E-before-consonant, U+1039 as visible killer, U+1060–U+1097 stacked forms); swap for a proper detector if it misfires`.
- [ ] **Step 4:** Implement `api/translate.ts` (`envFromProcess` reads `GEMINI_API_KEY`, `GEMINI_MODEL` default `gemini-3.5-flash`, `GEMINI_TIER` default `free`; a missing key → 500 `upstream` with no detail). Add a Vite plugin in `vite.config.ts` with `apply: 'serve'` whose `configureServer` mounts `/api/translate` and calls the same handler (load `.env` with Vite's `loadEnv(mode, cwd, '')`; convert Node req/res to `Request`/`Response`).
- [ ] **Step 5:** Run the tests. Expected: PASS. Run `pnpm check`. Expected: 0 errors.
- [ ] **Step 6:** Manual check on dev (port 5173, never 4173): `pnpm dev`, then
  `curl -s -X POST http://localhost:5173/api/translate -H "origin: http://localhost:5173" -H "content-type: application/json" -d "{\"lines\":[{\"n\":1,\"text\":\"WHERE ARE YOU GOING?\",\"cls\":\"bubble\",\"speaker\":\"woman\"}]}"`
  Expected: `{"ok":true,"lines":[{"n":1,"text":"…Burmese…"}],...}`. The same call with `origin: https://evil.test` → 403. Stop the dev server.
- [ ] **Step 7:** Commit `feat(comic): Vercel translate function, dev mount, reply check`.
- [ ] **Step 8 (needs owner):** Ask the owner to push this branch and add `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_TIER` to Vercel (Preview + Production). On the preview URL, repeat the curl against `https://<preview>/api/translate`. Expected: a Burmese reply (proves Vercel builds `api/` next to the static site). If Vercel doesn't build it, stop and report; don't work around it.

### Task 4: Reading order, wrapping and fitting

**Files:**
- Create: `src/lib/comic/order.ts`, `src/lib/comic/fit.ts`
- Test: `src/lib/comic/order.test.ts`, `src/lib/comic/fit.test.ts`

**Interfaces:**
- Produces:
  - `interface Box { x: number; y: number; w: number; h: number }` (page pixels), exported from `types.ts`.
  - `readingOrder<T extends { box: Box }>(items: T[], rtl?: boolean): T[]`
  - `wrapBurmese(text: string, maxWidth: number, measure: (s: string) => number): string[]`
  - `fitText(text: string, box: Box, page: Box, measure: (s: string, size: number) => number, opts?: { maxSize?: number; minSize?: number; lineHeight?: number }): { size: number; lines: string[]; box: Box; mode: 'fit' | 'grown' | 'cover' }`. Defaults `maxSize 28`, `minSize 12`, `lineHeight 1.7` (room for marks above and below).

- [ ] **Step 1: Write failing tests** (measure = 10 px per grapheme × size/10, via `Intl.Segmenter` grapheme count):
  - `order.test.ts › rows then left to right`: boxes at (300,10), (10,20), (10,200) (all h=40) → order (10,20), (300,10), (10,200). `rtl` → (300,10), (10,20), (10,200).
  - `fit.test.ts › wraps at word breaks`: `wrapBurmese('ဘယ်သွားမလဲရှင်', 30, m)` → every line is a concatenation of whole `Intl.Segmenter('my',{granularity:'word'})` segments, and the joined lines equal the input.
  - `breaks an overlong word by grapheme`: a single 8-grapheme word with maxWidth 30 → lines of ≤ 3 graphemes; no line starts with a combining mark (U+102B–U+103E, U+1039, U+103A).
  - `shrinks before growing`: text that fits at size 16 in the box → `mode 'fit'`, `size` 16 (largest that fits ≤ 28).
  - `grows inside the page, then covers`: text that doesn't fit at 12 in the box but fits when the box grows ≤ 15% per side → `'grown'`, box inside `page`; text too long even then → `'cover'`, box grown to fit, size 12, box clamped to `page`.
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3:** Implement. Row grouping: sort by `y`; a box joins the current row when its vertical overlap with the row is ≥ 50% of the smaller height. Fit order exactly: shrink (28 → 12) → grow box ≤ 15% per side inside `page` → cover (grow until it fits, clamped to `page`).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): reading order and Burmese wrap-and-fit`.

### Task 5: Erase choice

**Files:**
- Create: `src/lib/comic/erase.ts`
- Test: `src/lib/comic/erase.test.ts`

**Interfaces:**
- Produces: `eraseStyle(pixels: Uint8ClampedArray, cls: RegionClass): { mode: 'fill'; color: string } | { mode: 'cover' }`. `pixels` is RGBA for the box only.

- [ ] **Step 1: Write failing tests:**
  - `fills a plain bubble`: 90% white (255,255,255) + 10% black, cls `bubble` → `{ mode: 'fill', color: 'rgb(255,255,255)' }`.
  - `fills a tinted bubble`: 80% (250,240,200) + 20% black → fill with `rgb(250,240,200)`.
  - `covers busy art`: four colours at 25% each → `cover`.
  - `covers sfx and art text`: a plain-white box with cls `sfx` or `art-text` → `cover`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement: quantize each channel to 16 levels, take the most common colour; `fill` when its share is ≥ 60% and cls is `bubble` or `caption`, using the average of the pixels in that bucket.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): choose fill or cover for erasing`.

### Task 6: Opening images and PDFs

**Files:**
- Create: `src/lib/comic/load.ts`, `e2e/comic-fake.ts`
- Modify: `package.json` (add `pdfjs-dist`, pinned exact version)
- Test: `e2e/comic.e2e.ts` (first tests)

**Interfaces:**
- Consumes: `checkFile`, `readableImage` from `src/lib/input-checks.ts`.
- Produces:
  - `MAX_PDF_PAGES = 50`
  - `loadPages(file: File): Promise<{ ok: true; pages: ImageBitmap[] } | { ok: false; reason: string }>`. Images use `checkFile(file, 'image')`. PDFs (`application/pdf` or `.pdf`) are rendered with pdf.js at a scale giving 1600 px width, and pdf.js and its worker are imported dynamically (`import('pdfjs-dist')`, worker via `?url`).
  - `e2e/comic-fake.ts`: `comicPng(page): Promise<Buffer>` (draws a 600×800 white page with a white bubble outlined in black at (100,100,300,150) holding "HELLO THERE" in black, returns the PNG); `comicPdf(page, pages: number): Promise<Buffer>` (via a Chromium `page.pdf()` of N page-break divs); `fakeTranslate(page, reply: TranslateReply | 'quota')` (routes `**/api/translate` POST to the reply and GET to `{ model: 'gemini-3.5-flash', tier: 'free' }`).

- [ ] **Step 1: Write failing e2e tests** in `e2e/comic.e2e.ts` (chromium; PDFs are made in Chromium, so `test.skip(browserName !== 'chromium')` for the PDF tests only):
  - `opens an image`: upload `comicPng` → the original canvas shows, "Page 1 of 1".
  - `opens a PDF`: upload a 3-page `comicPdf` → "Page 1 of 3"; next goes to "Page 2 of 3".
  - `refuses over 50 pages`: a 51-page PDF → alert `That PDF has more than 50 pages. Split it and open one part at a time.`
  - `loads no PDF code for images`: while opening an image, no request URL contains `pdf.worker` or `pdfjs`.
  - `rejects other files`: `e2e/fixtures/not-an-image.png` → the existing `readableImage` message.
- [ ] **Step 2:** Add a bare `src/routes/comic-translator/+page.svelte` and `src/lib/components/ComicTranslator.svelte` with the file input and page canvas only, enough for these tests. Run `$env:E2E_PORT=4180; pnpm exec playwright test e2e/comic.e2e.ts --project chromium`. Expected: FAIL until `load.ts` exists.
- [ ] **Step 3:** `pnpm add pdfjs-dist@<current stable, exact>` and implement `loadPages`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): open images and PDFs in the browser`.

### Task 7: Workspace (layout B): boxes, list, translate, check

**Files:**
- Modify: `src/lib/components/ComicTranslator.svelte`, `src/routes/comic-translator/+page.svelte`
- Test: `e2e/comic.e2e.ts`

**Interfaces:**
- Consumes: `loadPages`, `readingOrder`, `translatePage`, `serviceInfo`, `checkLines`, types.
- Produces: page state per page: `regions: Region[]` where `interface Region { id: number; box: Box; cls: RegionClass; speaker: Speaker; english: string; burmese: string; problem: LineProblem | null }` (add to `types.ts`). Region numbers shown to the visitor follow `readingOrder`.

- [ ] **Step 1: Write failing e2e tests:**
  - `draws, numbers and lists boxes`: on the opened `comicPng`, drag two boxes → list rows "1" and "2" in reading order; each row has class select (default `bubble`), speaker select (default `unknown`), an English input, a Delete button. Delete removes the row.
  - `shows exactly what is sent`: type "HELLO THERE" (speaker man) → the region labelled `Sent to Gemini (text only)` reads `1 [man] HELLO THERE`.
  - `sends text only`: on Translate page, the captured POST body equals `{"lines":[{"n":1,"text":"HELLO THERE","cls":"bubble","speaker":"man"}]}`, and no request carries image data (`data:image` or a body over 20 kB).
  - `fills Burmese and flags problems`: fake reply with n=1 Burmese and n=2 missing → row 1 shows the Burmese, row 2 shows `Didn’t come back. Retry or type your own.` in the error style; `Retry` re-sends the page and only updates flagged rows.
  - `quota keeps work`: fake `'quota'` → alert `Today’s translations are used up. Try again tomorrow.`; boxes and English stay.
  - `states the tier`: with tier `free`, the page shows `Translating with gemini-3.5-flash on the free tier: only use public-domain or openly licensed pages.`
  - `nothing leaves on load`: opening the page and an image makes no request off `localhost` and no POST.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Build layout B as the owner chose (mockup: original left with numbered boxes, labelled `Original (stays on your device)`; Burmese right; bubble list and the yellow sent box below). Drawing with pointer events on an overlay; keyboard: list rows are reachable and Delete works by keyboard. The visitor can edit the Burmese text in each row. `<meta name="robots" content="noindex">` until plan 3 adds examples and the report card (*builder's call*: not linked from the home page yet).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): layout B workspace with boxes, sent text and checks`.

### Task 8: Lettering and download

**Files:**
- Create: `src/lib/comic/render.ts`
- Modify: `src/lib/components/ComicTranslator.svelte`, `package.json` (add `@fontsource/noto-sans-myanmar`)
- Test: `e2e/comic.e2e.ts`

**Interfaces:**
- Consumes: `fitText`, `wrapBurmese`, `eraseStyle`, `Region`.
- Produces: `renderPage(ctx: CanvasRenderingContext2D, page: ImageBitmap, regions: Region[]): Promise<{ fit: number; grown: number; cover: number }>`. Waits for `document.fonts.load('28px "Noto Sans Myanmar"')` first. Erases (fill colour or white covering box with a 2 px black border), then draws centred lines in black. The returned counts are kept for plan 3's fitting score.

- [ ] **Step 1: Write failing e2e tests:**
  - `letters the Burmese in place`: after a fake reply for the bubble, the Burmese canvas pixels inside the box differ from the original (text was erased and redrawn), and pixels outside every box are identical.
  - `uses the Myanmar font`: `document.fonts.check('16px "Noto Sans Myanmar"')` is true after rendering.
  - `downloads a PNG`: `Download PNG` produces `comic-page-1-my.png`, a PNG whose size equals the original page.
  - `edits redraw`: changing row 1's Burmese text changes the Burmese canvas.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** `pnpm add @fontsource/noto-sans-myanmar@<exact>` (import only in the component, so other pages don't load it). Implement `renderPage` and wire it to replies and edits.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): letter Burmese into the page and download PNG`.

### Task 9: Quality gates and handoff

**Files:**
- Modify: `e2e/comic.e2e.ts`, `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Add tests:** `has no axe violations` (opened page with one translated box, Light and Dark); `fits a phone` (375 px wide: `document.documentElement.scrollWidth <= 375`); webkit project runs the non-PDF tests.
- [ ] **Step 2:** Run the full suite on a free port: `$env:E2E_PORT=4180; pnpm test:unit --run; pnpm check; pnpm exec playwright test`. Expected: all pass (existing counts unchanged plus the new tests).
- [ ] **Step 3:** One real end-to-end check by hand on `pnpm dev`: open a Pepper&Carrot page (CC BY 4.0, from peppercarrot.com, English), draw 3 boxes, translate, download. Show the owner the PNG. Note in HANDOFF that real-artist pages wait for the paid plan.
- [ ] **Step 4:** Update `docs/superpowers/HANDOFF.md`: what the page does, env names, `E2E_PORT`, the Vercel step status, and that plans 2 and 3 are next.
- [ ] **Step 5:** Commit `docs(comic): handoff for the translate page`. Ask the owner before any push.
