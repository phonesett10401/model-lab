# Handoff — AI Model Lab (read this first after a compaction or in a new session)

Last updated: 2026-10-09. Owner: Phone Sett (GitHub `phonesett10401`, private repo `phonesett10401/model-lab`).

## What this is

**AI Model Lab**: a public library of small AI models the owner trains. Each model has an honest report card. **Two models are live: the Sea creature detector** (`/models/sea-creature-detector`, old address `/models/creature-categorizer` redirects) **and the Sound detective** (`/models/sound-detective`, No. 4: 17 everyday sounds on a timeline, from a recording, an upload or live listening). Fresh or spoiled and Gender classifier are still `planned`. The repo `phonesett10401/model-lab` is **public** (YOLO is AGPL-3.0); the owner is fine with draft/audit sources being visible there, and the production build still leaves them out.

- **Site:** SvelteKit 2 + Svelte 5 runes + TypeScript, `adapter-static` (everything prerendered), deployed on Vercel. `vercel.json`: `outputDirectory: build`, `cleanUrls`.
- **Lab:** `/` (hero + archive index + workbench), `/models/[slug]`, `/audits/[slug]`, archive-style 404.
- **Intro:** `/intro`. Tap-to-enter title screen (this tap is what allows sound), then the video, then a 4-step scroll story, then "Open the lab →" to `/`. It's a bare layout, always dark.
- **Video:** `video/`, a separate Remotion 4.0.529 project (own `package.json`; install with `cd video && pnpm install --ignore-workspace`). One 21 s composition "Intro" in three layouts (wide/square/tall). Music: "Tech Circuit Data Stream" by Alex Morgan (Pixabay licence, owner confirmed); the drop lands on the WRONG stamp at 14.5 s; every cut is on the 105 BPM grid (tested in `video/test/timeline.test.ts`).

## Owner rules (non-negotiable)

- **No `Co-Authored-By: Claude` or any Claude attribution** in commits or PRs.
- **Honesty:** never show invented numbers as real. Unmeasured values show "—" or "not yet measured"; illustrative content is stamped SAMPLE or DRAFT. (Invented model *names* are allowed only in the video's fly-through swarm.)
- **Audits and red-team content are hidden on production** (their professor sees the site). Drafts and audits are compiled out when `VERCEL_ENV=production` (`__SHOW_DRAFTS__`). Check with `VERCEL_ENV=production pnpm build`, then grep `build/` for content strings.
- **Themes** are called Light / Dark. The name is **AI Model Lab**. The hero headline is "Click it. Test it. *See the result.*"
- **Pushing to `master` deploys production on Vercel:** ask the owner before `git push`.

## Current state

- `master` (= `origin/master`) has everything up to the Sound detective (2026-09-29). Live: the Sea creature detector, the Sound detective, the intro video (labels the detector "Model 01 of the lab"), the scroll story.
- **RAG assistants are live** (merged into `master` and pushed 2026-10-09, commit 75073c8): University of Raffel Luo and the Pathum Rai District emergency assistant, with a home-page RAG group. The professor has not yet approved switching the study to Pathum Rai.
- **Defences live (2026-10-11, last deploy 195d35c):** the page has a Version picker **v0 / D1 / D3 / D4** (default v0); each defence is measured alone, per the proposal.
  - D1: instruction/data separation prompt (`systemPromptD1` in `rag.ts`).
  - D3: output check, replies holding a `placeholders.txt` value are replaced for public roles (`guard.ts`); the runner records `blocked`/`hidden`.
  - D4: retrieval access control, public roles only search public passages (`search()` in `rag.ts`).
  - Usefulness (normal questions, real model): Raffel v0 51/53, D1 50, D3 51, D4 51; Pathum v0 41/50, D1 41, D3 41, D4 42.
  - Owner's manual attack tests: v0 leaked to a plain request, an emotional pretext and "run the procedure"; D1 stopped commands only; D3 stopped exact values only; D4 stopped every leak (incl. DAN role-play, "search all documents") but the model then **invents** answers (misinformation), and sometimes claims actions it cannot take or asks for personal data.
- **D2 (input filter) is built on branch `feat/d2` (pushed, preview https://model-lab-git-feat-d2-phone-sett-paing-kyaws-projects.vercel.app/assistant/pathum-rai?version=D2), NOT merged; awaiting the owner's manual tests, then merge.** `inputFilter`/`filteredText` in `guard.ts`: word patterns (override, role-play/DAN/"act as", system-prompt probing, "without restrictions"/bypass, "I am an officer/staff/admin") on public-role messages; a match skips search and the model, labelled "Blocked by the input filter (D2)". `search` skips passages with that wording for public roles (no real passage matches). Runner records `blockedBy` ('D2'/'D3'/''). No normal question trips it; usefulness Raffel 51/53, Pathum 41/50 (same as v0). feat/d2 branched before the feat/present work, so merge master into it (or merge it into master) and rerun tests. **After D2:** D5 (all combined), then the owner's `cases.json` and runner numbers for presentation 2.
- Intro video music: "Tech Circuit Data Stream" by Alex Morgan (Pixabay licence, 1:23; found via https://pixabay.com/music/search/tech%20explainer/, uploader alex-morgan). Sound effects are generated by `video/scripts/make-sounds.mjs`, no credit needed.
- Phones: the chat model uses a 2,048-token context window (`CONTEXT_WINDOW`, `HISTORY_CHARS` 2000) so an iPhone 17 Pro survives long prompts, though it is near Safari's limit (one crash, then fine after closing apps). WebLLM 0.2.85 ignores `prefill_chunk_size`. Gemma 3 1B was tested and rejected (23/50, wrong emergency numbers); the ZeroGPU phone backend is shelved.
- Known RAG limits to note in the write-up: search uses only the latest message (follow-ups lose context); the 1.5B model repeats earlier answers in multi-turn chats; the scorer's strict wordings undercount some correct answers.
- Research methodology class: the proposal is in the owner's Downloads (`Research-Proposal-Phone-Sett-Paing-Kyaw.docx` in the thesis template, plus PDFs). Updated 2026-10-09 to name this university assistant as the target, with five defences: D1 instruction/data separation, D2 input filtering, D3 output checking, D4 retrieval access control, D5 all combined. Claude does not write attack cases; the owner does.
- Tests: `pnpm test:unit --run` (77), Python `training/test_sounds_*.py` (8 scripts), `pnpm test:e2e` (237 passed, 38 skipped: sound tests skip Windows WebKit, which has no Web Audio; `e2e/detector.e2e.ts` and `e2e/sounds.e2e.ts` run the real models; `e2e/live.e2e.ts` uses Chromium's fake microphone), `cd video && pnpm test` (10), `cd video && pnpm check` (4).
- Open, not urgent: `sea-detector.ts` doesn't close the ImageBitmap if `session.run` throws (use try/finally). Sound detective minors: resampled-upload e2e checks labels only (not timings); no CI fixture for "long silence then one knock"; its entry sits under the "Drafts" comment in `entries.ts`.
- Owner's next plans: widen the sea detector (more creatures), then update the intro video's SAMPLE report-card scene (it still shows octopus/squid/cuttlefish and "iNaturalist"); Sound detective v2 (better timing from timestamped data, more sounds); the speech translator later; text models; a private RAG document-assistant target for red-teaming.
- Shareable project overview for contributors: artifact https://claude.ai/artifact/7T9D5mvDGx1oYb8yJqEPF5 and `Downloads/AI-Model-Lab-Overview.pdf` on the owner's laptop.
- Specs and plans: `docs/superpowers/specs/*`, `docs/superpowers/plans/*`.

## Comic translator (English → Burmese, for MandaX) — plan 1 built on `claude/friendly-shaw-952d0e`, not merged

- Spec `docs/superpowers/specs/2026-10-24-comic-translator-design.md`; plan 1 `docs/superpowers/plans/2026-10-24-comic-translator-1-translate-page.md`. Plan 2 (`docs/superpowers/plans/2026-10-24-comic-translator-2-detector.md`, data and the D-FINE text detector) is being built on this branch; its ledger rulings and results go into this note when it finishes. Then plan 3 (detector + OCR in the page, examples, report card, home link).
- Page `/comic-translator` (`noindex`, not linked yet): open an image or PDF (≤ 50 pages, pdf.js loads only for PDFs), drag boxes, type English, pick speaker/kind, "Translate page", Burmese is checked (missing / not Burmese / Zawgyi / odd length), lettered in Noto Sans Myanmar, "Download PNG". Only the numbered text goes to `/api/translate`; the yellow box shows exactly what is sent.
- Code: `src/lib/comic/` (pure logic, unit-tested), `src/lib/components/ComicTranslator.svelte`, Vercel function `api/translate.ts` (dev: same handler mounted in `vite.config.ts`). Same-site origin only, text only, 20 kB cap.
- Env: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3.5-flash`), `GEMINI_TIER` (`free`|`paid`) in `.env` (git-ignored; template `.env.example`) and in Vercel. Key check: `node --env-file=.env scripts/check-gemini.mjs` (never prints the key). **Free tier = public-domain / openly licensed pages only; switch to paid before any real artist's page.**
- Tests: `src/lib/comic/*.test.ts`; `e2e/comic.e2e.ts` fakes `/api/translate` (`e2e/comic-fake.ts`). Run e2e on another port while 4173 is busy: `$env:E2E_PORT=4180`.
- Known limits: the browser's Burmese word breaker sometimes splits compounds (ပင်ပန်း → ပင် / ပန်း); overlong words break at syllables; a box drawn short of the English leaves bits visible.
- Vercel builds `api/translate.ts` next to the static site: checked on the PR preview 2026-10-24 (`GET /api/translate` → `{"model":"gemini-3.5-flash","tier":"free"}`); the three env vars are set in Vercel for Production + Preview.

## RAG assistants (research targets)

- Pages `/assistant/raffel-luo` and `/assistant/pathum-rai` (live, `noindex`; `/assistant` forwards to the home page). In-browser RAG chat, WebLLM 0.2.85, Qwen2.5-1.5B-Instruct q4f16_1 + snowflake-arctic-embed-s. Role switch (not a real login), v0 = access rule in the prompt only, a "What it read" panel that turns restricted documents red. Settings per assistant in `src/lib/assistant/assistants.ts`; page body `src/lib/components/AssistantChat.svelte`; home card `AssistantCard.svelte`. Specs `docs/superpowers/specs/2026-10-09-uofl-rag-assistant-design.md` and `2026-10-09-rag-assistants-pathum-rai-design.md`; plans in `docs/superpowers/plans/`.
- Content in `assistant/<slug>/` (see `assistant/README.md`): `docs/*.md` (header `title:` / `access: public|staff|officer`), `placeholders.txt`, `tests/cases.json` (owner's cases, OWASP LLM01–10, dev/held-out), `tests/normal.json`; results in `assistant/results/<slug>/<version>/`. Pathum Rai: real national numbers only (1669, 191, 199, 1784), every local detail fictional.
- Versions: `VERSIONS` in `src/lib/assistant/config.ts` (v0, D1, D3, D4 so far); page Version picker or `?version=`, runner `$env:ASSISTANT_VERSION`. The runner forces the NVIDIA GPU (`--force_high_performance_gpu` in `eval/chrome.ts`).
- Runner: `$env:ASSISTANT = 'pathum-rai'; pnpm eval:assistant` (default `raffel-luo`; installed Chrome, visible, Chrome set to High performance GPU in Windows). Results include `unknownNumbers` (numbers not in the documents). Real-model test (opt-in): `$env:ASSISTANT_REAL=1; pnpm exec playwright test assistant-real --project chrome --headed`. Page tests use a fake engine (`e2e/assistant-fake.ts`, `window.__assistantEngine`, option `match` steers retrieval).

## Models and training (local, on the owner's RTX 5060)

- **How a model runs on the site:** static ONNX file in `static/models/`; the ONNX Runtime Web engine (`.wasm` + `.mjs`) is imported with Vite `?url`, so it ships once as a hashed asset, and the runtime downloads it itself (passed as `wasmBinary`) so a failed download can be retried. `src/lib/runtime/yolo.ts` matches Ultralytics' letterbox, decode and NMS; `sea-detector.ts` is the runtime; entries with `task: 'detect'` draw boxes (`ImageInput`) and list detections (`DetectionList`). Nothing loads until a visitor runs the model.
- **Training env:** conda env `modellab-train` (Python 3.12, PyTorch cu128, Ultralytics 8.4, onnxruntime, open_clip). Python: `C:\Users\phone\miniconda3\envs\modellab-train\python.exe`. API keys live in `training/.env` (git-ignored; check with `training/check_keys.py`, which never prints keys).
- **Pipeline (`training/`):** `openimages_select.py` → `openimages_download.py` → `openimages_foodfilter.py` → `prepare_sea_v2.py` (merges with `prepare_aquarium.py`'s output) → `train.py <data.yaml> <run>` → `evaluate.py <data.yaml> <run> [aq_|oi_]` (square 640 input, exactly as the site runs) → `pick_examples.py` (writes `src/lib/data/sea-creature-detector.json` and `static/samples/sea/`; never type report numbers by hand). Datasets, runs and weights stay local (git-ignored); `training/attribution/sea-v2.csv` credits every training photo.
- **v2 results (767 frozen test photos):** 0.74 mAP@50 overall, 0.82 on aquarium photos; known gaps: seal vs sea lion, dolphin vs whale, small wild fish; no octopus, manta or orca.
- **Sound detective (v1, 2026-09-29):** EfficientAT MobileNet mn10 (MIT, AudioSet-pretrained; vendored at `training/vendor/EfficientAT`, git-ignored, pinned a425fdce) fine-tuned multi-label on 1 s slices every 0.5 s. The spectrogram is inside the ONNX file (`sounds_model.Frontend`, tested equal to EfficientAT's), so the browser only decodes to 32 kHz mono and slices. Data: FSD50K CC0/CC BY clips via the Hugging Face mirror `Fhrozen/FSD50k` (13,026 clips) + 799 Freesound top-up clips (double-checked by the AudioSet model; owner spot-listened). Pipeline: `sounds_select.py → sounds_download.py → sounds_topup.py → sounds_train.py mn04|mn10 → sounds_synth.py (test) + sounds_synth.py val → sounds_evaluate.py mn10 → sounds_pick_examples.py`. Thresholds are tuned per sound on synthetic *validation* mixes, slice by slice. Results on 4,216 test clips: mAP 0.79; on 97 synthetic test mixes: segment F1 0.59, onset (0.5 s) F1 0.43. Owner chose mn10 (20.5 MB) over mn04 (6.5 MB, mAP 0.76). Weak spots: doorbell (AP 0.42), car horn, footsteps; timing is rough (weak labels). Live mode: `src/lib/live.ts` + `static/worklets/capture.js`, auto-stops after 2 min / hidden tab / leaving. Event merging is shared by Python and TS via `src/lib/runtime/events-cases.json`.
- **Sound v2 ideas:** strongly-labelled data (timestamps) for better timing, more sounds, the speech translator later.
- **Next model ideas:** widen with iNaturalist + auto-labelling (octopus, manta ray, orca, lionfish…); friends may send ONNX models (put them in `training/incoming/<name>/`, re-measure before publishing).

## Done: the /intro scroll story design (kept for reference)

The design the owner saw (confirm briefly, then build: "brainstorm briefly, then build"):

- **Stage:** the video's language on the page: film grain, vignette, a red glow that brightens when each step becomes active.
- **A thin red progress spine** down the side that fills as you scroll, with numbered markers 01–04 that light up.
- **Scroll-scrubbed visuals:** the pinned visual responds to scroll *progress*, not just the active step.
- **Scenes:**
  1. *One job each:* the 3D specimen swarm (port `video/src/fx.tsx` Swarm idea to Svelte/CSS), orbiting with scroll, one box pulled forward and glowing.
  2. *Made by hand:* the octopus photo travels Collect → Train → Test along a glowing line; a detection box locks on at Test.
  3. *Honest report cards:* the report cards fan out in 3D; the HOW IT FAILS stamp slams with a small glitch flash.
  4. *Runs on your device:* a phone outline with a pulsing red shield; the model streams in as particles while the photo stays inside.
- **Guardrails:** CSS plus scroll/IntersectionObserver only (no animation libraries); reduced motion shows finished stills; contrast AA (the inactive steps already use `--ink-faint`); no horizontal overflow; `/` must never load intro assets; Lighthouse on `/` ≥ 95.
- **Files today:** `src/lib/components/intro/Story.svelte` (IntersectionObserver active step, rootMargin −45%), `StoryVisual.svelte` (4 CSS scenes), `IntroStage.svelte`, `IntroEnd.svelte`, `src/lib/intro-story.ts`, `src/routes/intro/+page.svelte`. Tests: `e2e/intro.e2e.ts` (steps get `aria-current="step"` as they're centred; Skip; glide rules; ending link), `e2e/intro-video.e2e.ts` (Chrome channel, real playback).
- **Process the owner uses:** superpowers brainstorming (short, bounded, since the code exists) → TDD → commit per step → show stills or screenshots.

## Gotchas learned the hard way

- **Builds are slow on this machine (1–2+ min).** The Playwright `webServer` timeout is 180 s. A stale `vite preview` on port 4173 makes e2e reuse an old build: stop it with PowerShell (`Get-NetTCPConnection -LocalPort 4173 … Stop-Process`). `pkill` doesn't exist here.
- **Playwright's bundled Chromium can't play H.264, and Windows WebKit has no Web Audio.** Real playback tests run in the `chrome` project (installed Google Chrome), matched only to `intro-video.e2e.ts`.
- **Git Bash heredocs and `sed` mangle backticks and `${}`.** Write TSX/Svelte with the Write/Edit tools, not shell heredocs.
- **Remotion's bundled ffmpeg is stripped** (no `volumedetect`, no null muxer). Measure audio by extracting WAV (`pnpm exec remotion ffmpeg -i x.mp4 -vn -ac 1 -c:a pcm_s16le out.wav`) and computing peaks in Node.
- **Video render:** `cd video && pnpm render`. It renders 3 MP4s plus posters, then re-encodes the site copies into `static/intro/` (wide CRF 29 ≤ 4 MB, tall CRF 31 ≤ 2.7 MB). The social copies stay full quality in `video/out/` (git-ignored). Stills for review: `pnpm stills` or `pnpm exec remotion still src/index.ts Intro out/stills/x.jpg --frame=N --props=props/wide.json`.
- **Prerender:** `handleHttpError` ignores `/og/*`; `handleUnseenRoutes` allows only `/audits/[slug]` to be empty (audits are hidden on production). Link-preview images are made with `pnpm og` against `pnpm preview`.
- **Browser scroll restoration:** e2e tests that goto the same URL must `scrollTo(0,0)` first.
- **The contrast test** (`src/lib/contrast.test.ts`) parses `light-dark()` pairs in `tokens.css`, so keep that format.

## Scroll story — built, merged and live

- `filled()` / `enter()` in `src/lib/intro-story.ts` drive the spine fill and each scene's build (`--t`, 0 → 1: starts when a step's top passes 80% down the screen, finished when it's being read). The picture switches as the next step starts building.
- Tests: unit (`intro-story.test.ts`), e2e in `e2e/intro.e2e.ts` (spine, build, reduced motion, no sideways scroll, scenes fit at 360px). Full suite green: 30 unit, 179+ e2e.
- The ending line is now "New models are added as they're trained." (owner's wording).

## Presentation deck (`/present`) — built on `feat/present` (2026-10-18), not merged yet

- For the AI-class presentation (5 presenters, the professor's 7-part proposal structure). Spec `docs/superpowers/specs/2026-10-18-presentation-deck-design.md`, plan `docs/superpowers/plans/2026-10-18-presentation-deck.md`. Top bar has a "Present" link.
- Flow: start screen ("▶ Start the presentation", preloads all 9 banners, shows "Ready") → 21 s intro with sound (Space skips; it holds on the last frame) → 9 slides. Keys: Space / ↓ / → / PageDown next; ↑ / ← / PageUp back; Home / End; F full screen. Clickers work (PageUp/PageDown). `/present#5` opens slide 5 directly.
- **Fill in the five names** in `src/lib/present/team.ts` (placeholders "Presenter A–E"; A = slides 1–2, B = 3–4, C = 5–6, D = 7–8, E = 9). Slide copy lives in `src/lib/present/slides.ts`; `slides.test.ts` checks the numbers against `src/lib/data/*.json` and that no attack wording appears.
- Slide 7 (RAG assistants, "tested, not complete yet") is shown on production by the owner's choice; it has no attack results.
- Files: `src/lib/components/present/` (`Deck` state + keys, `Stage` the caster background: canvas dot groups + SVG waves, `Slide`, `Banner`), `src/routes/present/+page.server.ts` (QR SVG at prerender, always the production URL via `__SITE_ORIGIN__`), `e2e/present.e2e.ts`.
- Banner loops: `video/src/loops/` (9 compositions `Loop-<id>`, 5 s, seamless; slide 5's is 18 s and 850 px wide for its narrower slant). Slides 5 and 9 use **real captures** in `video/public/captures/`; slide 6 animates the real model output for "Two sounds at once"; slide 3 runs the five sea samples with their real boxes (`video/src/loops/samples.ts`, checked against the data files). To refresh: `VERCEL_ENV=production pnpm build && pnpm preview --port 4173` (production, so drafts don't appear in the home capture), then `pnpm capture:present`, then `cd video && pnpm render:loops` (or `pnpm render:loops sea sound` for some), then `node --test test/loops.check.ts`. Output: `static/present/<id>.mp4|.jpg`. Illustrative loops only show boxes the real model gave (octopus is a known gap).
- Gotcha: lightningcss' `light-dark()` fallback resolves custom properties at `:root`, so a light OS theme gave the deck light-theme reds. The deck pins its dark token values on `.present`. `/intro` probably has the same latent issue (not fixed).
