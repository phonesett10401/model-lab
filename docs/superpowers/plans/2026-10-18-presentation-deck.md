# Presentation deck (`/present`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/present` route that plays the 21 s intro, then 9 keyboard-driven slides on a calm animated "caster stage", each with its own Remotion banner loop.

**Architecture:** Slide content and the team list are typed data files; pure navigation logic (keys → actions, hash ↔ index) lives in one tested module. A Svelte `Deck` owns state (gate → intro → slides), a `Stage` draws the never-restarting background (canvas dots + SVG waves), and `Slide` renders content plus a `Banner` in one of four layouts. Banner loops are new Remotion compositions in `video/`; slides 5, 6 and 9 are built from real Playwright screen captures of the live pages.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, adapter-static, Vitest, Playwright; Remotion 4.0.529 (`video/`, own install); `qrcode` (new devDependency, prerender only).

**Spec:** `docs/superpowers/specs/2026-10-18-presentation-deck-design.md`

## Global Constraints

- Branch: `feat/present` from `master` (not `feat/d2`).
- No Claude attribution in commits. Never `git push` without asking the owner (pushing `master` deploys production).
- Honesty: only measured numbers; they must equal `src/lib/data/sea-creature-detector.json` / `sound-detective.json` (or `HANDOFF.md` for "0.82 on aquarium photos"). Illustrative loops carry the SAMPLE stamp (`Sample` from `video/src/parts.tsx`); capture-based loops (5, 6, 9) do not.
- No attack/red-team results anywhere in the deck. Slide 7 is shown on production with an `IN PROGRESS` tag.
- Colours/fonts: existing tokens only (`--paper` `#141213`, `--red` `#ff4f4f`, `--ink`, `--ink-soft`, `--ink-faint`, `--hairline`; Instrument Serif, Geist, JetBrains Mono). `/present` is always dark (`color-scheme: dark`, like `/intro`).
- No animation libraries; no spinning rings. Stage motion is calm.
- `/` must not request anything under `/present/`.
- Fit 1280×720 to 1920×1080 with no overflow; text contrast AA.
- Write Svelte/TSX with Write/Edit tools, not shell heredocs (Git Bash mangles backticks and `${}`).
- Builds take 1–2 min; stop a stale `vite preview` on 4173 before e2e (see HANDOFF "Gotchas").

## Review Focus

1. Key held down / mashed during a transition → index still moves one slide per press and never past 1 or 9 (test in Task 1 `clamps and ignores repeats`, Task 2 e2e `mashing Space never skips past the last slide`).
2. Typing in nothing-focused vs a focused button: Space on a focused button must not both click it and advance (Task 2 e2e `Space on the focused start button starts once`).
3. Opening `/present#5` directly (refresh mid-talk) → lands on slide 5, no gate replay of the intro (Task 2 e2e `a hash opens that slide directly`).
4. A banner video that fails to load (offline, 404) → slide still shows its poster and the deck keeps working (Task 6 e2e `a missing banner video falls back to its poster`).
5. Window resized between 1280×720 and 1920×1080 (projector switch) → no overflow and the dot canvas resizes (Task 3 e2e `every slide fits at 1280×720 and 1920×1080`).

---

### Task 1: Deck data and navigation logic

**Files:**
- Create: `src/lib/present/team.ts`, `src/lib/present/slides.ts`, `src/lib/present/deck.ts`
- Test: `src/lib/present/deck.test.ts`, `src/lib/present/slides.test.ts`

**Interfaces:**
- Produces:
  - `team.ts`: `export type Presenter = { key: 'A'|'B'|'C'|'D'; name: string; role: string }`; `export const team: Presenter[]` = A "Presenter A" "The lab", B "Presenter B" "The making", C "Presenter C" "The models", D "Presenter D" "What's next".
  - `slides.ts`: `export type BannerLayout = 'strip' | 'slant' | 'monitor' | 'band'`; `export type Slide = { n: number; act: string; tag: string; kicker: string; title: string; titleEm?: string; bullets: string[]; stat?: { value: number; digits: number; label: string }; built?: boolean; presenter: Presenter['key']; layout: BannerLayout; loop: string }`; `export const slides: Slide[]`; `export const loopSrc = (id: string) => \`/present/${id}.mp4\``; `export const posterSrc = (id: string) => \`/present/${id}.jpg\``.
  - `deck.ts`: `export type Action = 'next' | 'prev' | 'first' | 'last' | 'fullscreen' | null`; `keyAction(key: string): Action`; `step(index: number, action: Action, count: number): number` (index 0 = intro, 1..count = slides, clamped); `indexFromHash(hash: string, count: number): number | null`; `hashFor(index: number): string`.

- [ ] **Step 1: Write the failing tests**

`deck.test.ts`:
```ts
test('keys map like PowerPoint and clickers', () => {
  for (const k of [' ', 'ArrowDown', 'ArrowRight', 'PageDown']) expect(keyAction(k)).toBe('next');
  for (const k of ['ArrowUp', 'ArrowLeft', 'PageUp']) expect(keyAction(k)).toBe('prev');
  expect(keyAction('Home')).toBe('first'); expect(keyAction('End')).toBe('last');
  expect(keyAction('f')).toBe('fullscreen'); expect(keyAction('F')).toBe('fullscreen');
  expect(keyAction('a')).toBeNull();
});
test('clamps and ignores repeats', () => {
  expect(step(9, 'next', 9)).toBe(9); expect(step(0, 'prev', 9)).toBe(0);
  expect(step(0, 'next', 9)).toBe(1); expect(step(4, 'first', 9)).toBe(1); expect(step(4, 'last', 9)).toBe(9);
  expect(step(4, null, 9)).toBe(4); expect(step(4, 'fullscreen', 9)).toBe(4);
});
test('hash round-trips and rejects junk', () => {
  expect(hashFor(4)).toBe('#4'); expect(indexFromHash('#4', 9)).toBe(4);
  for (const h of ['', '#', '#0', '#10', '#x', '#-1']) expect(indexFromHash(h, 9)).toBeNull();
});
```
`slides.test.ts`:
```ts
test('9 slides numbered 1..9 with the professor tags', () => {
  expect(slides.map((s) => s.n)).toEqual([1,2,3,4,5,6,7,8,9]);
  expect(slides.map((s) => s.tag)).toEqual(['§1 TOPIC & TEAM','§2 SCOPE','§3 METHODS','§4 METHODS','§5 RESULT','§6 RESULT','EXTRA · IN PROGRESS','EXTRA','§7 CONCLUSION']);
});
test('layouts follow the spec and never repeat on neighbours', () => {
  expect(slides.map((s) => s.layout)).toEqual(['slant','monitor','band','strip','slant','strip','band','slant','monitor']);
  slides.slice(1).forEach((s, i) => expect(s.layout).not.toBe(slides[i].layout));
});
test('result numbers equal the measured data files', () => {
  // read src/lib/data/*.json; the "Test score" data row starts with the number shown
  expect(slides[4].stat).toMatchObject({ value: 0.74, digits: 2 });
  expect(slides[5].stat).toMatchObject({ value: 0.79, digits: 2 });
  expect(sea.data.find((d) => d.label === 'Test score')!.value.startsWith('0.74')).toBe(true);
  expect(snd.data.find((d) => d.label === 'Test score')!.value.startsWith('0.79')).toBe(true);
});
test('no attack results leak into slide copy', () => {
  const text = JSON.stringify(slides).toLowerCase();
  for (const w of ['leak', 'dan', 'jailbreak', 'd1', 'd3', 'd4', 'placeholder']) expect(text).not.toMatch(new RegExp(`\\b${w}\\b`));
});
```

- [ ] **Step 2: Run** `pnpm test:unit --run src/lib/present` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `team.ts`, `deck.ts`, and `slides.ts`.** `slides.ts` copy is fixed here (exact text):

| n | act | presenter | kicker | title (+titleEm) | bullets | stat / built | loop |
|---|---|---|---|---|---|---|---|
| 1 | I · THE LAB | A | AI CLASS · PROJECT PROPOSAL | AI Model + *Lab* | "Click it. Test it. See the result." then one bullet per team member: `${name} · ${role}` (built from `team`) | — | `swarm` |
| 2 | I · THE LAB | A | WHAT IT DOES | What the lab + *does* | Try a small AI model right in your browser · Use a sample, your own photo or sound, or live listening · See an honest report card: the score and how it fails · Nothing you add is uploaded: it runs on your device · 2 models live, more planned | — | `boxes` |
| 3 | II · THE MAKING | B | METHODS · LEARNING | How the models + *learn* | Supervised learning on labelled data: 7,637 sea photos (Open Images, Aquarium Combined) and 13,825 sound clips (FSD50K, Freesound) · Transfer learning: fine-tuned pretrained CNNs, YOLO26 Nano for detection and EfficientAT mn10 (AudioSet) for sound · Train / validation / test split; the test set stays frozen: 767 photos and 4,216 clips never seen in training · Sound is multi-label: spectrograms of 1 s slices every 0.5 s, several sounds at once | — | `pipeline` |
| 4 | II · THE MAKING | B | METHODS · PREDICTING | How they predict, and how we + *measure* | Object detection: boxes with confidence; IoU and non-max suppression remove duplicates · Thresholds: 45% for creatures; per-sound thresholds tuned on validation, never on test · Metrics: mAP@50, mean average precision and F1, plus a list of how each model fails · On-device inference: exported to ONNX and run by ONNX Runtime Web in the browser | — | `device` |
| 5 | III · THE MODELS | C | MODEL 01 · UI PROTOTYPE | Sea creature + *detector* | Boxes 14 kinds of sea creature in a photo · 0.82 on aquarium photos · Fails on: seal vs sea lion, dolphin vs whale, small distant fish | `{0.74, 2, 'mAP@50 · 767 test photos'}`, built | `sea` |
| 6 | III · THE MODELS | C | MODEL 04 · UI PROTOTYPE | Sound + *detective* | 17 everyday sounds on a timeline · From a recording, an upload or live listening · Weak spots: doorbell, footsteps, car horn; timing is rough | `{0.79, 2, 'mAP · 4,216 test clips'}`, built | `sound` |
| 7 | IV · WHAT'S NEXT | D | IN PROGRESS | RAG + *assistants* | Answers from its own documents: retrieve the right passages, then a small language model writes the reply · Runs in the browser: Qwen2.5-1.5B and snowflake-arctic-embed-s on WebLLM · Two built: University of Raffel Luo and Pathum Rai District · Tested, not complete yet: we are measuring defences against tricky prompts | — | `rag` |
| 8 | IV · WHAT'S NEXT | D | ROADMAP | What's + *coming* | More sea creatures: octopus, manta ray, orca, lionfish · Sound detective v2: better timing, more sounds · A speech translator · Text models | — | `coming` |
| 9 | IV · WHAT'S NEXT | D | CONCLUSION · REFERENCES | What we + *built* | 2 working models and 2 RAG assistants, all running on your device · Every number is measured; every report card shows how it fails · Data: Open Images V7 (CC BY 2.0), Aquarium Combined (Roboflow, CC BY 4.0), FSD50K and Freesound (CC0 / CC BY) · Models: Ultralytics YOLO26 (AGPL-3.0), EfficientAT (MIT), Qwen2.5, snowflake-arctic-embed · Tools: ONNX Runtime Web, WebLLM, Remotion · Music: "Tech Circuit Data Stream" by Alex Morgan (Pixabay licence) | — | `site` |

Tags are the list in the test. Note: the "leak" test uses word boundaries, so "DAN" must not appear as a word anywhere in copy.

- [ ] **Step 4: Run** `pnpm test:unit --run src/lib/present` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(present): slide data, team placeholders and navigation logic`

---

### Task 2: `/present` route, gate, intro and keyboard navigation

**Files:**
- Create: `src/routes/present/+page.svelte`, `src/lib/components/present/Deck.svelte`
- Modify: `src/routes/+layout.svelte` (bare layout for `/present`; top-bar link)
- Test: `e2e/present.e2e.ts`

**Interfaces:**
- Consumes: Task 1 `slides`, `keyAction`, `step`, `indexFromHash`, `hashFor`.
- Produces: `Deck.svelte` props `{ qr: string }` (SVG markup from Task 4; pass `''` until then). DOM contract used by later tests: root `main.present` with `data-index` (0 = intro, 1..9); gate button "▶ Start the presentation"; `<video class="intro">`; each slide `section.slide[data-n]`, only the current one has `aria-current="step"`; HUD counter `.counter` text `LIVE 04 / 09`.

Behaviour (from spec): gate "Tap or press Space to start" (button text `▶ Start the presentation`, hint `Space, arrows or a clicker · F for full screen`). Start → `video.play()` unmuted *before any await* (copy the comment and pattern from `IntroStage.svelte`), src `/intro/intro-wide.mp4`. Next during intro = skip to slide 1; on `ended` hold the last frame. Keydown on `window`; `preventDefault` for handled keys; ignore `event.repeat`; ignore keys while a transition is running is NOT needed (one press = one step). F → `document.documentElement.requestFullscreen()` / `exitFullscreen()`. Index changes write `history.replaceState(null, '', hashFor(i))`. On mount, `indexFromHash(location.hash)` non-null → skip gate, go straight there (no intro). If `play()` rejects, show native controls as `IntroStage` does. `<svelte:head>`: title `Presentation · AI Model Lab`, `<meta name="robots" content="noindex">`.

Layout: `bare` becomes `page.route.id === '/intro' || page.route.id === '/present' || …og-card`. Top bar: add `<a class="intro-link mono" href="/present">Present</a>` before the intro link (reuse the class).

- [ ] **Step 1: Write failing e2e tests** in `e2e/present.e2e.ts` (viewport 1280×720; stub `HTMLMediaElement.prototype.play = () => Promise.resolve()` via `addInitScript`, as `intro.e2e.ts` does with a reject):
  - `the gate shows the start button and the title` — button `▶ Start the presentation` visible; title `Presentation · AI Model Lab`.
  - `Space on the focused start button starts once` — focus the button, press Space → `data-index` = `0`, `video.intro` visible; press Space → `data-index` = `1`.
  - `the intro holds its last frame until a press` — start, dispatch `ended` on the video → still `data-index` 0; ArrowDown → 1.
  - `arrows, PageUp/PageDown, Home and End move one slide` — from 1: PageDown → 2, ArrowRight → 3, ArrowUp → 2, End → 9 (counter `LIVE 09 / 09`), Home → 1, ArrowLeft → 1 (stays; back from 1 does not reopen the intro).
  - `mashing Space never skips past the last slide` — End, then Space ×5 → 9.
  - `a hash opens that slide directly` — goto `/present#5` → `data-index` 5, no gate, `location.hash` `#5`; press ArrowDown → hash `#6`.
  - `the top bar links to the presentation` — on `/`, link `Present` has href `/present`.
- [ ] **Step 2: Run** `pnpm test:e2e e2e/present.e2e.ts --project chromium` — Expected: FAIL (404).
- [ ] **Step 3: Implement** the route, `Deck.svelte` (slides rendered as plain title + bullets for now) and the layout change.
- [ ] **Step 4: Run** the same command — Expected: PASS. Also `pnpm check` → 0 errors.
- [ ] **Step 5: Commit** `feat(present): /present route with intro gate and PowerPoint-style keys`

---

### Task 3: Stage, slide visuals and transitions

**Files:**
- Create: `src/lib/components/present/Stage.svelte`, `src/lib/components/present/Slide.svelte`, `src/lib/components/present/Banner.svelte`
- Modify: `src/lib/components/present/Deck.svelte`
- Test: `e2e/present.e2e.ts` (add), `src/lib/present/countup.test.ts`
- Create: `src/lib/present/countup.ts`

**Interfaces:**
- Consumes: Task 1 `Slide`, `BannerLayout`, `posterSrc`, `loopSrc`, `team`.
- Produces: `Banner.svelte` props `{ layout: BannerLayout; loop: string; src?: string; active: boolean }` (renders `<video muted loop playsinline>` with `poster={posterSrc(loop)}`, plays only while `active`; `src` defaults to `loopSrc(loop)`; root `.banner[data-layout]`). `countup(value: number, t: number): number` — eased 0→value for t in [0,1], clamps, never exceeds value.

Visual reference to match: `.superpowers/brainstorm/1303-1792320707/content/stage-calm.html` option B (stage) and `banner-layouts.html` A/C/E/F (banners). Port the dot-group canvas algorithm and the 7-path wave SVG from `stage-calm.html` as-is (G = 16 px grid, 5 groups, life 3–6 s, flicker rule). Stage is rendered once by `Deck` behind all slides and never re-mounts. Also from the mockup: grain, vignette, scan line (6 s), corner brackets, HUD (`AI MODEL LAB · ACT {act}` + `PROPOSAL {tag}` left; `● LIVE 0n / 09` right, blinking dot).

Banner geometry (16:9 slide): strip = right 25%, full height, flush; slant = right 52%, full height, `clip-path: polygon(28% 0,100% 0,100% 100%,0 100%)`; monitor = right 7%, top 18%, 40% wide, 16:10, hairline border + red glow; band = full width, bottom 24%. Text column width per layout: strip 62%, slant 46%, monitor 46%, band 85% (top area). Lower-third `NOW PRESENTING · {name} · {role}` bottom-left on every slide (above the band on band slides).

Transitions: on index change, outgoing content does a 250 ms red scan-wipe out; incoming kicker → title → bullets → lower-third stagger in (~90 ms apart, 600 ms each, translateY 14px→0); banner clip-path wipes open last (+300 ms). Back = same, wipe direction reversed. Slides 5–6: a mono label `EXPECTED` flips to `BUILT ✓` (400 ms after enter) and the stat counts up over 1.2 s via `countup`. `prefers-reduced-motion` (`reducedMotion` from `$lib/motion.svelte`): stage draws one static frame, no scan line, transitions are 150 ms opacity fades, stat shows final value.

- [ ] **Step 1: Failing tests.** `countup.test.ts`: `countup(0.74,0)===0`, `countup(0.74,1)===0.74`, monotonic over 20 steps, `countup(0.74,1.5)===0.74`, never `> 0.74`. e2e additions:
  - `every slide fits at 1280×720 and 1920×1080` — for both sizes, go through 1..9 and assert `document.documentElement.scrollWidth <= innerWidth` and the current `.slide` content box (`.copy`) is within the viewport (`boundingBox`), and for 1280×720 also after resizing from 1920×1080 the stage `canvas` width equals the new viewport width.
  - `each slide uses its banner layout` — slide n's `.banner` has `data-layout` equal to `slides[n-1].layout`.
  - `result slides show measured numbers` — on #5 after 2 s, `.stat` text contains `0.74`; on #6 `0.79`; label `BUILT ✓` visible.
  - `reduced motion shows finished slides` — `page.emulateMedia({ reducedMotion: 'reduce' })`, goto `#5`, `.stat` contains `0.74` immediately (within 300 ms).
  - `the presenter tag shows on every slide` — `.lower` contains `NOW PRESENTING` on 1..9.
- [ ] **Step 2: Run** `pnpm test:unit --run src/lib/present` and `pnpm test:e2e e2e/present.e2e.ts --project chromium` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** `countup.ts`, `Stage.svelte`, `Banner.svelte`, `Slide.svelte`; wire into `Deck`. Posters may be missing until Task 6 (a dark plate shows).
- [ ] **Step 4: Run** both commands — Expected: PASS. Run `e2e/a11y.e2e.ts` style axe check on `/present#1` and `#9` (add `present has no axe violations` to `present.e2e.ts` using `@axe-core/playwright` as `a11y.e2e.ts` does) — Expected: 0 violations.
- [ ] **Step 5: Screenshot** slides 1, 5, 9 at 1920×1080 (Playwright `page.screenshot`, not committed) and compare against the mockups by eye.
- [ ] **Step 6: Commit** `feat(present): caster stage, banner layouts and slide transitions`

---

### Task 4: QR code to the production site

**Files:**
- Create: `src/routes/present/+page.ts`
- Modify: `vite.config.ts` (define `__SITE_ORIGIN__`), `src/app.d.ts` (declare it), `package.json` (devDependency `qrcode`, plus `@types/qrcode`), `src/lib/components/present/Slide.svelte` (slide 9 QR + address)
- Test: `e2e/present.e2e.ts` (add)

**Interfaces:**
- Produces: `+page.ts` `export const prerender = true; export async function load() { return { qr: await QRCode.toString(__SITE_ORIGIN__, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }), origin: __SITE_ORIGIN__ }; }` (runs only at prerender, so `qrcode` never ships to the browser). `__SITE_ORIGIN__` = the existing `origin` constant in `vite.config.ts` (production URL from `VERCEL_PROJECT_PRODUCTION_URL`, else `http://localhost:4173`).

Slide 9 shows the QR (white modules on a `#f3eeee` plate for contrast, at least 28% of slide height) next to the monitor banner, plus the address in mono without `https://`. The QR is page-drawn, never animated (spec: must scan from the back of the room).

- [ ] **Step 1: Failing e2e** `slide 9 shows a QR for the site and its address` — goto `#9`; `.qr svg` visible with height ≥ 0.28 × viewport height; `.qr` has `data-origin` equal to `http://localhost:4173` in the local build; address text visible.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** `pnpm add -D qrcode @types/qrcode`.
- [ ] **Step 4: Run** — Expected: PASS. Then `VERCEL_ENV=production pnpm build` and confirm `grep -r "qrcode" build/_app` finds nothing (library not shipped).
- [ ] **Step 5: Commit** `feat(present): QR code to the live site on the last slide`

---

### Task 5: Real screen captures for slides 5, 6 and 9

**Files:**
- Create: `scripts/capture-present.mjs`
- Output (committed, small): `video/public/captures/sea-1.png`, `sea-2.png`, `sound-1.png`, `sound-2.png`, `home.png` (and gitignore nothing new)

**Interfaces:**
- Produces: PNG files above, 2× device scale, viewport 1280×900, consumed by Task 6 loops `sea`, `sound`, `site`.

Script: `import { chromium } from '@playwright/test'`; expects `pnpm preview --port 4173` already running (print a clear error and exit 1 if `fetch('http://localhost:4173')` fails). Steps, reusing the e2e approach (wait for `.demo[data-state="result"]`, 90 s timeout):
- `/models/sea-creature-detector`: click sample `Aquarium tank` → screenshot `.demo` → `sea-1.png`; click `Seal or sea lion?` → `sea-2.png` (shows a failure honestly).
- `/models/sound-detective`: click `Two sounds at once` → `sound-1.png`; click `Car horn (it misses this)` → `sound-2.png`.
- `/` in dark theme (set `localStorage` the way `ThemeToggle` does, or `colorScheme: 'dark'` context) full-page screenshot → `home.png`.
Add `"capture:present": "node scripts/capture-present.mjs"` to `package.json`.

- [ ] **Step 1: Run** `pnpm build && pnpm preview --port 4173` (background), then `pnpm capture:present`. Expected: 5 files written, each > 50 KB; open them and confirm boxes / timeline events are visible.
- [ ] **Step 2: Commit** `chore(present): real screen captures of the models and home page`

---

### Task 6: Remotion banner loops

**Files:**
- Create: `video/src/loops/index.tsx` (registers compositions), `video/src/loops/sizes.ts`, one file per loop: `Swarm.tsx`, `Boxes.tsx`, `Pipeline.tsx`, `Device.tsx`, `Sea.tsx`, `Sound.tsx`, `Rag.tsx`, `Coming.tsx`, `Site.tsx`
- Modify: `video/src/Root.tsx` (render `<Loops />` alongside `Intro`), `video/package.json` (script `"render:loops": "node scripts/render-loops.mjs"`)
- Create: `video/scripts/render-loops.mjs`, `video/test/loops.test.ts`, `video/test/loops.check.ts`
- Output: `static/present/{id}.mp4` + `static/present/{id}.jpg` for the 9 ids
- Test (site): `e2e/present.e2e.ts` (add)

**Interfaces:**
- Consumes: `video/src/theme.ts` `c`, `font`; `video/src/fx.tsx` `Grain`, `Vignette`, `Swarm`, `Bloom`; `video/src/parts.tsx` `Sample`, `Stamp`; captures from Task 5 via `staticFile('captures/…')`.
- Produces: `sizes.ts` `export const LOOP_FPS = 30; export const LOOP_FRAMES = 150; export const loopSize = { strip: { width: 480, height: 1080 }, slant: { width: 1000, height: 1080 }, monitor: { width: 1280, height: 800 }, band: { width: 1920, height: 280 } } as const; export const loops = [{ id: 'swarm', layout: 'slant' }, { id: 'boxes', layout: 'monitor' }, { id: 'pipeline', layout: 'band' }, { id: 'device', layout: 'strip' }, { id: 'sea', layout: 'slant' }, { id: 'sound', layout: 'strip' }, { id: 'rag', layout: 'band' }, { id: 'coming', layout: 'slant' }, { id: 'site', layout: 'monitor' }] as const;` Composition ids: `Loop-${id}`.

Loop content (5 s, seamless — every animated value is a periodic function of `frame / LOOP_FRAMES`, so frame 150 ≡ frame 0; no audio):
- `swarm`: `Swarm` spinning one full turn per loop, one box pulled forward with `Bloom`. SAMPLE.
- `boxes`: 3×3 grid of model plates (`Plate`-style), a red highlight travels to one plate at a time, one job each label. SAMPLE.
- `pipeline`: a photo card slides left→right through four labelled stations COLLECT · TRAIN · TEST · SHIP; a detection box locks on at TEST. SAMPLE.
- `device`: tall phone outline, a red shield pulses; particles labelled ONNX stream in from the top, the photo stays inside. SAMPLE.
- `sea`: slow pan/zoom over `sea-1.png`, then cross-fade to `sea-2.png` and back; a red outline pulses around the result list. No SAMPLE (real capture).
- `sound`: `sound-1.png` scrolls slowly upward in the strip, cross-fade to `sound-2.png`. No SAMPLE.
- `rag`: chat bubbles scroll right→left along the band; one hits a shield and gets an `IN PROGRESS` `Stamp`. SAMPLE.
- `coming`: `Swarm` with new specimen boxes flying in labelled octopus / manta ray / orca / lionfish. SAMPLE.
- `site`: fly-through of `home.png` (pan top → bottom → top). No SAMPLE.

`render-loops.mjs` (same `run` helper shape as `render.mjs`): for each loop `remotion render src/index.ts Loop-{id} out/loops/{id}.mp4 --codec=h264 --crf=24 --muted`, then re-encode into `../static/present/{id}.mp4` with `-c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart -an`, and `remotion still … --frame=0 --jpeg-quality=80` → `../static/present/{id}.jpg`.

- [ ] **Step 1: Failing tests.** `video/test/loops.test.ts` (node:test): `loops` has the 9 ids in slide order; every `layout` is a key of `loopSize`; ids match `slides.ts` `loop` fields (read `../src/lib/present/slides.ts` text and regex `loop: '(\w+)'`) and their order; `LOOP_FRAMES / LOOP_FPS === 5`. `video/test/loops.check.ts`: each `../static/present/{id}.mp4` exists, ffprobe duration within 0.1 s of 5, size matches `loopSize[layout]`, no audio stream, file ≤ 1.5 MB; each `.jpg` exists. Site e2e `a missing banner video falls back to its poster`: `page.route('**/present/sea.mp4', r => r.abort())`, goto `#5`, `.banner video` has `poster` `/present/sea.jpg` and the deck still advances with ArrowDown.
- [ ] **Step 2: Run** `cd video && pnpm test` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `sizes.ts`, loops, `index.tsx`, `Root.tsx` change. Review each with `pnpm exec remotion still src/index.ts Loop-{id} out/stills/{id}.jpg --frame=0` and `--frame=75`.
- [ ] **Step 4: Run** `cd video && pnpm test && pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Render** `cd video && pnpm render:loops`, then `node --test test/loops.check.ts` — Expected: PASS (raise the re-encode CRF for any file over 1.5 MB).
- [ ] **Step 6: Run** site e2e `pnpm test:e2e e2e/present.e2e.ts --project chromium` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(video): nine banner loops for the presentation deck`

---

### Task 7: Preload every banner on the start screen

**Files:**
- Create: `src/lib/present/preload.ts`
- Modify: `src/lib/components/present/Deck.svelte`, `Banner.svelte` (accept the blob URL as `src`)
- Test: `src/lib/present/preload.test.ts`, `e2e/present.e2e.ts` (add)

**Interfaces:**
- Produces: `preloadAll(urls: string[], onProgress: (done: number, total: number) => void, fetcher = fetch): Promise<Map<string, string>>` — fetches each URL in parallel, maps url → `URL.createObjectURL(blob)`; a failed fetch maps url → url itself (fall back to network) and still counts as done. Deck starts it on mount (gate screen) for `slides.map(s => loopSrc(s.loop))` and shows a quiet mono line `Loading banners 4 / 9` → `Ready` under the start button; starting before it finishes is allowed.

- [ ] **Step 1: Failing tests.** `preload.test.ts` with a fake fetcher: all succeed → 9 blob URLs, progress called 9 times ending `(9, 9)`; one rejects → that entry equals its original URL, others blob URLs. e2e `/ never loads presentation assets`: collect requests on `/` (wait `networkidle`), none contains `/present/`. e2e `the start screen preloads every banner`: on `/present`, wait until `Ready` visible; requests include all 9 `/present/*.mp4`.
- [ ] **Step 2: Run** unit + e2e — Expected: FAIL.
- [ ] **Step 3: Implement.** Stub `URL.createObjectURL` in the unit test.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(present): preload banners on the start screen so classroom wifi can't stall a slide`

---

### Task 8: Full verification and handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md` (new section "Presentation deck": route, files, how to fill in names in `src/lib/present/team.ts`, `pnpm capture:present` → `cd video && pnpm render:loops` order, keys)

- [ ] **Step 1: Run** `pnpm check` (0 errors), `pnpm test:unit --run` (all pass), `pnpm test:e2e --workers=2` (all pass except known skips), `cd video && pnpm test && pnpm check && pnpm typecheck`.
- [ ] **Step 2: Production build check:** `VERCEL_ENV=production pnpm build`; `build/present.html` exists; `grep -l "RAG" build/present.html` finds it (slide 7 is on production); `grep -ri "jailbreak\|leaked" build/present.html` finds nothing.
- [ ] **Step 3: Manual run-through** in installed Chrome at 1920×1080 via `pnpm preview`: Start → intro with sound → hold → Space through all 9 → F full screen → Home/End; screenshot slides 1, 5, 7, 9 for the owner.
- [ ] **Step 4: Commit** `docs: handoff covers the presentation deck`. Ask the owner before any push.
