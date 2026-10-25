# Comic translator, plan 3 of 3: automatic boxes and English in the page, measured, on the lab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/comic-translator` finds the English itself (our D-FINE detector + an in-browser OCR), Gemini repairs OCR slips while translating, the whole pipeline is measured on the frozen test pages, and the translator gets a report card, finished examples and a home-page entry.

**Architecture:** Two new browser runtimes in `src/lib/comic/`: `detect.ts` (the plan-2 ONNX model on the existing ONNX Runtime Web engine, `openSession` in `src/lib/runtime/engine.ts`) and `ocr.ts` (Tesseract.js, all files self-hosted). The page's hand tools stay as the way to fix mistakes. A Playwright evaluation (`pnpm eval:comic`, own config, real Gemini through the dev server) runs the real page over the test pages and writes the pipeline numbers; the report card reads them plus plan 2's `src/lib/data/comic-translator.json`.

**Tech Stack:** SvelteKit 2 / Svelte 5, onnxruntime-web (already installed), `tesseract.js@7.0.0` (Apache-2.0) + `@tesseract.js-data/eng` (English traineddata), Vitest, Playwright, Python (`comictrain` env) only for the true-text file.

**Spec:** `docs/superpowers/specs/2026-10-24-comic-translator-design.md` (How a page is translated, Report card, Layout handling). Plans 1–2 and `docs/superpowers/HANDOFF.md` (Comic translator section) describe what exists.

## Global Constraints

- Comic images never leave the browser: the detector, OCR, erasing and lettering all run locally; only numbered text goes to `/api/translate`. Every model/OCR file is served from our own site (no CDN), and nothing downloads until the visitor asks for automatic boxes.
- Free tier only with public-domain / openly licensed pages (Pepper&Carrot, Black Jack free reuse). The evaluation sends only the text of those test pages.
- Numbers on the site come only from scripts (`comic_evaluate.py`, `pnpm eval:comic`); unmeasured = `null` / "not yet measured". Keep plan 2's disclosures (labels automatic, Claude-reviewed, shaped by an earlier detector; misses counted by Claude, owner checked 4 of 20 and agreed with 4). Sound effects stay "not measured" with the reason "the automatic labels contain no sound effects".
- Credits: Pepper&Carrot "David Revoy, CC BY 4.0"; Black Jack "Give My Regards to Black Jack / Shuho Sato / Manga on Web".
- Never port 4173 or `pnpm eval:assistant`; e2e with `E2E_PORT=4180`, the new eval on 4181, dev server on 5174.
- No Claude attribution in commits. **No push until the owner says everything is done** (owner, 2026-10-25). Squash-merge PR #1 later (a stray weight file sits in one old commit).

## Review Focus

1. **The detector finds nothing (or the model fails to download):** a plain message, the hand tools still work, a Retry button. Test in Task 5 (`auto finds nothing`, `download fails`).
2. **OCR returns empty or junk for a box:** the row is flagged "Couldn't read this. Type the English." and is not sent until typed. Test in Task 3 (`junk is not English`) and Task 5 (`unread boxes are not sent`).
3. **A tall webtoon page:** the detector runs on overlapping tiles and boxes on tile edges are merged, not doubled. Test in Task 2 (`tiles cover a tall page`, `edge boxes merge`).
4. **The free-tier daily cap is hit in the middle of `eval:comic`:** progress is saved per page and a rerun continues; a "used up" reply waits and stops cleanly instead of recording zeros. Test in Task 6 (`resume skips done pages`).
5. **Gemini "repairs" English into something new** (adds words): the repaired English is shown next to what the OCR read, and the visitor's own edits are never overwritten. Test in Task 4 (`repair never overwrites an edit`).

---

### Task 1: True text for Pepper&Carrot pages, and the word score

**Files:** Create `training/comic_truth.py`, `training/test_comic_truth.py`, `src/lib/comic/score.ts`, `src/lib/comic/score.test.ts`.

**Interfaces:**
- `comic_truth.py`: for every logged Pepper&Carrot page in val/test, downloads `https://framagit.org/peppercarrot/webcomics/-/raw/master/<episode folder>/lang/en/E<NN>P<PP>.svg` (1 request/s), extracts the text of each `<text>` element (joined `<tspan>`s), writes `training/data/comic/truth.json` = `{file: [text, …]}` and copies it to `src/lib/data/comic-truth-pepper.json` (text only, CC BY 4.0, credited in the report).
- `score.ts`: `words(s: string): string[]` (lower-case, letters/digits/apostrophes, split on anything else) and `wordRecall(truth: string[], got: string[]): { found: number; total: number }` (multiset: each true word counts once per occurrence).

- [ ] **Step 1: Tests first.** `test_comic_truth.py`: `svg_text` on a small inline SVG with two `<text>` elements, one with two `<tspan>`s → `['HELLO THERE', 'Bye']`. `score.test.ts`: `words("It's TOO hard...")` → `["it's", 'too', 'hard']`; `wordRecall(['a b b'], ['b a'])` → `{ found: 2, total: 3 }`.
- [ ] **Step 2:** Run both (`…\comictrain\python.exe test_comic_truth.py`, `pnpm test:unit --run src/lib/comic/score.test.ts`). Expected: FAIL.
- [ ] **Step 3:** Implement; run `comic_truth.py`. Expected: one entry per Pepper&Carrot val/test page; spot-check one page by eye.
- [ ] **Step 4:** Commit `feat(comic): true text for Pepper&Carrot test pages and the word score`.

### Task 2: Detector in the browser

**Files:** Copy `training/runs/comic/final2-dfine/model.onnx` → `static/models/comic-text-detector.onnx`. Create `src/lib/comic/detect.ts`, `src/lib/comic/detect.test.ts`.

**Interfaces:**
- `MODEL_URL = '/models/comic-text-detector.onnx'`, `MODEL_MB = 15.8`, `CLASSES` = plan-2 order `['bubble', 'caption', 'sfx', 'art-text']`, `MIN_SCORE = 0.3`.
- `tiles(w: number, h: number): Box[]` (one tile when `h <= 1.5 * w`; else squares of side `w` stepping by `0.75 * w`, last tile flush with the bottom).
- `mergeBoxes(dets: Detection[], iou = 0.5): Detection[]` (class-aware; overlapping boxes from neighbouring tiles become their union, keeping the higher score). `interface Detection { box: Box; cls: RegionClass; score: number }`.
- `comicDetector()` → `{ sizeLabel, load(onProgress), detect(bmp: ImageBitmap): Promise<Detection[]> }`. Input: RGB 0–1 resized to 1024×1024 (`images`), `orig_target_sizes` = tile `[w, h]`; outputs `labels`, `boxes` (x0,y0,x1,y1 in tile pixels), `scores`.

- [ ] **Step 1: Tests first** (`detect.test.ts`): `tiles(1000, 1200)` → one tile; `tiles(800, 3000)` → tiles of 800×800, first at y 0, last ending at 3000, neighbours overlapping by 200; `edge boxes merge`: a bubble split across two tiles as boxes (100,700,200,100) and (100,750,200,120) → one box (100,700,200,170); two different classes in the same place stay two.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement (reuse `openSession`; same shared-instance pattern as `seaDetector`). **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): text detector in the browser, tiled for tall pages`.

### Task 3: OCR in the browser

**Files:** Modify `package.json` (`tesseract.js@7.0.0`, `@tesseract.js-data/eng` exact). Create `src/lib/comic/ocr.ts`, `src/lib/comic/ocr.test.ts`.

**Interfaces:**
- `readBox(bmp: ImageBitmap, box: Box): Promise<{ text: string; conf: number }>`: crop with 4 px margin, upscale ×2, grey, Tesseract page-segmentation "single block"; worker created once and reused.
- `looksEnglish(text: string, conf: number): boolean`: at least 2 letters A–Z and conf ≥ 40.
- Worker, core (all four `tesseract-core*.wasm.js` variants) and `eng.traineddata` are imported with Vite `?url`, so they ship as hashed same-origin assets. Verify the import paths on the installed package; nothing may load from a CDN.

- [ ] **Step 1: Tests first.** `ocr.test.ts › junk is not English`: `looksEnglish('~~ |', 80)` false; `looksEnglish('HELLO', 30)` false; `looksEnglish('HELLO THERE', 85)` true.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Measured pick of the Tesseract model:** `eng` "best" vs "fast" traineddata, scored by word recall (Task 1) on 20 Pepper&Carrot val pages' labelled boxes (a small Playwright script in the scratchpad that calls `readBox`). Keep the better one; record both numbers in `training/comic_vendor.md`. *My call, for the owner to see: OnnxTR/docTR mobile was not measured — it has no maintained browser runtime, so it would mean writing our own detection and decoding code.*
- [ ] **Step 6:** Commit `feat(comic): self-hosted English OCR`.

### Task 4: Gemini repairs OCR slips

**Files:** Modify `src/lib/comic/types.ts`, `translate-server.ts`, `check.ts`, `client.ts`; tests in `translate-server.test.ts`, `check.test.ts`.

**Interfaces:**
- `GotLine` gains `english?: string` (the English as Gemini read it). The prompt adds: "The English comes from OCR and may contain reading mistakes; fix them from context, and return the corrected English as `english` for each line." `parseGemini` keeps `english` when it is a string.
- `Region` gains `ocr: string` (what OCR read) and `edited: boolean` (the visitor typed in the English field).
- `applyRepair(region: Region, got: GotLine): Region`: sets `english` to `got.english` only when `!region.edited`; never touches `ocr`.

- [ ] **Step 1: Tests first:** `parses repaired English` (fenced JSON with `english` → kept); `prompt mentions OCR mistakes`; `repair never overwrites an edit` (edited region keeps its text; unedited one takes the repair; `ocr` unchanged in both).
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): Gemini returns repaired English; edits always win`.

### Task 5: "Find the text for me" in the page

**Files:** Modify `src/lib/components/ComicTranslator.svelte`, `src/routes/comic-translator/+page.svelte`; e2e in `e2e/comic.e2e.ts`; add fixture `e2e/fixtures/comic-pepper.jpg` (a Pepper&Carrot test page, CC BY 4.0, credited in `e2e/fixtures/README` or the existing credits place).

**Interfaces:** consumes `comicDetector`, `readBox`, `looksEnglish`, `applyRepair`, `readingOrder`.

- Button **"Find the text for me"** next to the hand tools, with the download size (`sizeLabel` of detector + OCR) and a progress bar. On finish, each detection becomes a region (class from the detector, speaker `unknown`), its English filled by OCR, `ocr` kept. Rows OCR couldn't read show **"Couldn't read this. Type the English."** and are left out of the sent text until typed.
- Checkbox **"Manga order (right to left)"** feeds `readingOrder(…, rtl)`.
- Each row shows the OCR reading under the English when Gemini repaired it ("OCR read: …").

- [ ] **Step 1: e2e tests first** (real model, chromium; the fake Gemini from `e2e/comic-fake.ts`):
  - `nothing downloads before asking`: open the page and a fixture image → no request for `comic-text-detector.onnx`, tesseract, or `.traineddata`.
  - `finds the text`: fixture page → at least 3 rows, each with a box, a class and non-empty English; no request leaves our own site (Gemini is faked).
  - `auto finds nothing`: a plain white image → message "No English found. Draw boxes by hand." and the draw tools still work.
  - `download fails`: route the model URL to fail → alert with Retry; hand tools still work.
  - `unread boxes are not sent`: a box over a blank area → row says "Couldn't read this…"; the POST body has no line for it.
  - `manga order`: with the checkbox on, the right-hand box is number 1.
- [ ] **Step 2:** Run (`$env:E2E_PORT=4180; pnpm exec playwright test e2e/comic.e2e.ts --project chromium`). Expected: new tests FAIL.
- [ ] **Step 3:** Implement. Remove `noindex` from the page only in Task 7 (with the report card).
- [ ] **Step 4:** Run the whole comic e2e file in chromium and webkit. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): find the English automatically, on the device`.

### Task 6: Measure the whole pipeline (`pnpm eval:comic`)

**Files:** Create `playwright.comic.config.ts` (port 4181, `pnpm dev --port 4181`, so `/api/translate` is the real handler), `eval/comic.e2e.ts`, `eval/comic-score.ts`, `eval/comic-score.test.ts`; `package.json` script `eval:comic`.

**Interfaces:**
- For each non-dropped real test page (Pepper&Carrot + Black Jack): open it in the page, "Find the text for me", "Translate page" (real Gemini), wait for the Burmese page; read back per region `{box, cls, ocr, english, burmese, mode}` (expose `data-*` attributes on rows, no test-only globals). Progress saved per page to `training/runs/comic/eval-pipeline.jsonl`; a rerun skips done pages; on `quota`, stop and report; on `busy`, wait 60 s and retry once.
- `comic-score.ts`: `replacedShare(labelled: Box[], translated: Box[]): number` (a labelled region counts as replaced when a translated box covers ≥ 50% of it); `fitShare(modes)` = share of `fit` among `fit|grown|cover`; OCR word recall before (`ocr`) and after (`english`) repair on Pepper&Carrot pages with true text.
- Writes `src/lib/data/comic-translator-pipeline.json`: `{ pages, replaced, fit, ocrBefore, ocrAfter, failures: [...] }` (failures: 3 test regions not replaced, with page, class, the labelled English, and a fixed one-line reason per class).
- Also saves 3 finished examples (2 Pepper&Carrot, 1 Black Jack, first by file name among test pages whose replaced share ≥ 0.8 — a rule, not hand-picked) as `static/samples/comic/<file>-en.jpg` / `-my.jpg` (1000 px wide) with `static/samples/comic/examples.json` (title, credit, licence, link).

- [ ] **Step 1: Tests first** (`comic-score.test.ts`): `replacedShare` (one of two covered → 0.5; a box covering 40% → not replaced); `fitShare(['fit','fit','cover','grown'])` → 0.5; `resume skips done pages` (helper that reads the jsonl returns done files).
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5 (needs the owner's go-ahead for ~100 free-tier Gemini calls with open-licence text):** run `pnpm eval:comic`. Commit the json, examples and script: `feat(comic): pipeline measured on the test pages, finished examples`.

### Task 7: Report card and home-page entry

**Files:** Modify `src/lib/types.ts` (`task` gains `'translate'`), `src/lib/entries.ts` (entry `comic-translator`, No. 5, live), `src/lib/components/Workbench.svelte` (for `translate`: the before/after examples and an "Open the translator →" link to `/comic-translator`, no model bench), `src/routes/comic-translator/+page.svelte` (drop `noindex`; link "How well it works →" to `/models/comic-translator`). Test: `e2e/comic.e2e.ts`, `src/lib/logic.test.ts` (or the entries test that exists).

**Interfaces:** the entry's `report` is built only from `comic-translator.json` and `comic-translator-pipeline.json`:
- data rows: training pages per source; test pages; the "Test labels" note; "Missed text check" ("counted by Claude on 20 pages; owner checked 4 and agreed with 4"); "English text found (of labelled)"; "Worst case (of all text)"; "OCR words read (before / after Gemini repair)"; "Text replaced on test pages"; "Burmese fitted without covering the art"; "Sound effects: not measured (the automatic labels contain no sound effects)".
- metrics: "Text found per kind (AP@50)" rows bubble / caption / sound effect (null) / text on art.
- failures: from the pipeline json.
- samples: the three examples (credits shown).

- [ ] **Step 1: e2e tests first:** home page lists "Comic translator"; `/models/comic-translator` shows the "Test labels" note, the worst-case row, "Sound effects" not measured, three examples with credits, and the link; `/comic-translator` has no `noindex` and links to the report card; axe clean (light/dark); 375 px no overflow.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(comic): report card, examples and home entry`.

### Task 8: Gates, handoff, whole-branch review

- [ ] Full unit + e2e (`E2E_PORT=4180`), `pnpm check`, all `training/test_comic_*.py`, `VERCEL_ENV=production pnpm build` (the page and report must be in the production build; nothing audit-related added).
- [ ] Update `docs/superpowers/HANDOFF.md` (what the page does now, eval command, where numbers come from, known limits, owner to-dos: Sato Manga Works report, paid Gemini before real artists).
- [ ] Fresh whole-branch review; fix Critical/Important with a failing test first.
- [ ] Ask the owner before pushing (owner: push only when everything is done), then squash-merge PR #1 on their word.

## Owner time this plan needs

- One go-ahead for the ~100 free-tier Gemini calls in Task 6.
- Looking at the finished page and examples before the push.
