# Handoff — AI Model Lab (read this first after a compaction or in a new session)

Last updated: 2026-09-28. Owner: Phone Sett (GitHub `phonesett10401`, private repo `phonesett10401/model-lab`).

## What this is

**AI Model Lab**: a public library of small AI models the owner trains. Each model has an honest report card. **One model is live: the Sea creature detector** (`/models/sea-creature-detector`, old address `/models/creature-categorizer` redirects). Fresh or spoiled and Gender classifier are still `planned`. The repo `phonesett10401/model-lab` is **public** (YOLO is AGPL-3.0); the owner is fine with draft/audit sources being visible there, and the production build still leaves them out.

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

- Branch `feat/sea-creature-detector` (built on `feat/training-setup`) puts the detector live; ask the owner before merging or pushing. The intro scroll story is done and live.
- Tests: `pnpm test:unit --run` (47), `pnpm test:e2e` (197 passed, 25 skipped; `e2e/detector.e2e.ts` runs the real model in Chromium and WebKit), `cd video && pnpm test` (10).
- Specs and plans: `docs/superpowers/specs/*`, `docs/superpowers/plans/*`.

## Models and training (local, on the owner's RTX 5060)

- **How a model runs on the site:** static ONNX file in `static/models/`, ONNX Runtime Web engine copied to `static/ort/` by `scripts/copy-ort.mjs` (runs before `dev`/`build`; `static/ort/` is git-ignored). `src/lib/runtime/yolo.ts` matches Ultralytics' letterbox, decode and NMS; `sea-detector.ts` is the runtime; entries with `task: 'detect'` draw boxes (`ImageInput`) and list detections (`DetectionList`). Nothing loads until a visitor runs the model.
- **Training env:** conda env `modellab-train` (Python 3.12, PyTorch cu128, Ultralytics 8.4, onnxruntime, open_clip). Python: `C:\Users\phone\miniconda3\envs\modellab-train\python.exe`. API keys live in `training/.env` (git-ignored; check with `training/check_keys.py`, which never prints keys).
- **Pipeline (`training/`):** `openimages_select.py` → `openimages_download.py` → `openimages_foodfilter.py` → `prepare_sea_v2.py` (merges with `prepare_aquarium.py`'s output) → `train.py <data.yaml> <run>` → `evaluate.py <data.yaml> <run> [aq_|oi_]` (square 640 input, exactly as the site runs) → `pick_examples.py` (writes `src/lib/data/sea-creature-detector.json` and `static/samples/sea/`; never type report numbers by hand). Datasets, runs and weights stay local (git-ignored); `training/attribution/sea-v2.csv` credits every training photo.
- **v2 results (767 frozen test photos):** 0.74 mAP@50 overall, 0.82 on aquarium photos; known gaps: seal vs sea lion, dolphin vs whale, small wild fish; no octopus, manta or orca.
- **Next model ideas:** widen with iNaturalist + auto-labelling (octopus, manta ray, orca, lionfish…); friends may send ONNX models (put them in `training/incoming/<name>/`, re-measure before publishing).

## Done: the /intro scroll story (kept for reference)

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
