# Presentation deck (`/present`) — design

Date: 2026-10-18. Owner: Phone Sett. Status: draft for the owner's approval.

## Why

The owner's group of four presents the project to the AI-class professor. The professor gave a proposal-presentation structure (5–7 slides): 1 topic and team, 2 scope/functions as a list, 3–4 techniques and methods that use the subject's knowledge, 5–6 expected result as a UI prototype, 7 conclusion and references. Most of the lab is already built, so the deck follows that skeleton (so the professor can tick it off) but shows real, working results instead of plans.

It is a tab on the lab's own website, so the presentation *is* the product: futuristic, broadcast-like, in the lab's colours, and it works like a PowerPoint (one keypress shows the whole next slide, with animation).

Feel the owner asked for: the animated stage behind the casters in a recent Mobile Legends: Bang Bang Thai livestream.

## Goals

- A `/present` route on the site, linked from the top bar as a "presentation tab".
- Opens with the existing 21 s Remotion intro, then the slides.
- Keyboard and clicker navigation like PowerPoint.
- Every slide has the same calm animated stage behind it and one video **banner** holding a unique, new Remotion loop about that slide's topic.
- The lab's colours and fonts (Dark theme).
- Honest: every number shown is a measured one from the repo.

## Non-goals

- No presenter view or speaker notes.
- No live-demo overlay (opening a real model over a slide).
- No click-by-click builds within a slide: one press = whole slide.
- No phone layout work beyond "doesn't break" (it's shown on a projector/laptop).
- No live RAG chat and no attack/red-team results on the slides; RAG is shown as built and tested but not complete.

## Anti-goals (would make it a failure even if it works)

- Busy, distracting motion. The owner rejected spinning rings as "annoying"; the stage must stay calm.
- Banners that crowd out the text (the owner rejected the top cinema band and the full-bleed video for this reason).
- Invented numbers presented as real (owner's honesty rule).
- Attack results (what leaked, which attacks worked) visible on production (owner's rule: the professor sees the site).
- Anything that makes `/` slower or loads deck assets on other pages.

## The deck

| # | Slide | Professor's section | Banner layout | Banner loop idea | On production? |
|---|---|---|---|---|---|
| 0 | Intro video (existing 21 s, with sound) | — | full screen | existing `static/intro/intro-wide.mp4` | yes |
| 1 | **AI Model Lab**: "Click it. Test it. *See the result.*" + the 4 team members | 1 Topic & team | C · slanted split | specimen swarm, one box pulled forward | yes |
| 2 | **What the lab does** (list): try a model in your browser, see its honest report card (incl. how it fails), nothing is uploaded; 2 models live, more planned | 2 Scope / functions | E · floating monitor | grid of model "boxes", one lights up: one job each | yes |
| 3 | **Methods I — how the models learn**: supervised learning on labelled data (Open Images + aquarium photos; FSD50K + Freesound sounds, all credited); transfer learning from pretrained CNNs (YOLO for detection, EfficientAT pretrained on AudioSet for sound); train / validation / frozen test split; multi-label audio on spectrograms of 1 s slices every 0.5 s | 3 Techniques | F · bottom stream band | a photo moving sideways through Collect → Train → Test → Ship | yes |
| 4 | **Methods II — how they predict and how we measure**: object detection (boxes + confidence, IoU, non-max suppression); per-sound thresholds tuned on validation, not test; metrics mAP@50, mAP, F1, plus where each fails; ONNX export, ONNX Runtime Web in the browser, so nothing leaves the device | 4 Techniques | A · full-height right strip | a tall phone/screen: the model streams in, the photo stays inside | yes |
| 5 | **Result I — Sea creature detector**: real UI, 0.74 mAP@50 on 767 test photos (0.82 on aquarium photos); gaps: seal vs sea lion, dolphin vs whale, small wild fish | 5 Result / UI prototype | C · slanted split | detection boxes locking onto creatures | yes |
| 6 | **Result II — Sound detective**: 17 everyday sounds on a timeline (recording, upload, live); mAP 0.79 on 4,216 test clips; weak spots: doorbell, car horn, footsteps; timing is rough | 6 Result / UI prototype | A · full-height right strip | waveform scrolling down, sound labels popping in | yes |
| 7 | **RAG assistants — tested, not complete yet**: two document assistants (University of Raffel Luo, Pathum Rai District) that answer from their own documents, running on the device (in-browser RAG: embed + retrieve + small LLM); we have tested them, and defences against tricky prompts are being measured. Status tag `IN PROGRESS`. No attack results | extra | F · bottom stream band | a chat bubble scrolls past, hits a shield, stamped IN PROGRESS | yes |
| 8 | **What's coming**: more sea creatures, Sound detective v2 (better timing, more sounds), a speech translator, text models | extra | C · slanted split | new specimens joining the swarm | yes |
| 9 | **Conclusion, references, live site**: what we built and learned; sources (datasets, pretrained models, music "Tech Circuit Data Stream" by Alex Morgan, Pixabay licence); the live site's address + big QR code | 7 Conclusion & refs | E · floating monitor | a fly-through of the real site ending on the QR code, then the QR holds still | yes |

Production shows all 9 slides after the video (the professor asked for 5–7; the owner chose to show the extra work).

All numbers above come from `docs/superpowers/HANDOFF.md` and the data files (`src/lib/data/*.json`). The builder must read the numbers from the existing data files where possible rather than retyping them; if typed, they must match those files exactly. "Expected result" slides (5, 6) may show a small `EXPECTED → BUILT ✓` flip, then the real numbers count up from 0 (proposed during brainstorming; the owner did not object).

**Team names:** placeholders ("Presenter A"…"Presenter D") in one small data file; the owner fills in names and who presents which slides later. The title slide lists all four; a "NOW PRESENTING · <name> · <role>" lower-third appears on each slide (on handover slides at least).

**Slide 7 visibility:** shown on production (owner's decision, 2026-10-18: the assistants are already public on the site, so the deck says they are built and tested but not complete). Usefulness scores may appear only if the owner asks; attack outcomes never do.

## The stage (same behind every slide)

Chosen by the owner from mockups (`.superpowers/brainstorm/1303-1792320707/content/stage-calm.html`, option B, is the reference to match):

- Ground `#141213` (the lab's `--paper` dark value), film grain, soft vignette.
- **Flashing dot groups** (owner liked this): a faint dot grid over the whole slide; a few groups of dots at a time light up red together, each group drifts in its own direction, flickering, then fades and respawns elsewhere.
- **Slow signal waves** (owner picked this): ~7 thin red lines along the bottom, rising and falling gently.
- A slow red scan line passing down (~6 s).
- Red corner brackets framing the slide.
- HUD top bar: left = "AI MODEL LAB · ACT …" plus a requirement tag such as `PROPOSAL §3 · METHODS`; right = blinking "● LIVE 04 / 09".
- No rings, nothing spinning.
- The stage does **not** restart between slides; only the content animates, so motion feels continuous like a livestream set.
- Drawn in the page (canvas for dots, SVG/canvas for waves), not video.
- `prefers-reduced-motion`: stage shows a still frame; slide changes are instant fades.

## Banners

- Four allowed layouts (owner's picks): **A** full-height right strip (~25%, flush to frame), **C** slanted split (right half cut on a diagonal, esports player-cam), **E** floating monitor (framed card hung on the set), **F** bottom stream band (short wide strip, loop scrolls sideways). Mockup reference: `banner-layouts.html` in the same folder.
- Each slide's layout is in the table above; no two adjacent slides share one.
- Each loop is a **new** 4–6 s seamless Remotion composition in the existing `video/` project, in the intro's visual language (reuse `fx.tsx`, `parts.tsx`, `theme.ts`). Rendered silent, muted, looping MP4 (plus poster) into `static/present/`. Illustrative content in a loop is stamped SAMPLE; loops never show a number that isn't measured.
- **Slides 5 and 6 (the professor's UI-prototype section) use real screen captures** (owner's decision): the banner loops are built from captures of the real `/models/sea-creature-detector` and `/models/sound-detective` pages running real sample results, not illustration, so no SAMPLE stamp is needed there.
- On slide 9 the QR must be scannable: the loop ends on the QR and it then holds still (or the QR is drawn by the page over/next to the banner — builder's call, as long as it scans from the back of a classroom).

## Navigation and controls (owner approved)

- `/present` opens on a "Tap or press Space to start" screen (the gesture unlocks sound, same as `/intro`).
- Then the intro plays full screen with sound. Space during the video skips it. At the end it holds on the last frame until the next press.
- Next: Space, ArrowDown, ArrowRight, PageDown. Back: ArrowUp, ArrowLeft, PageUp. Home / End: first / last. F: fullscreen toggle. PageUp/PageDown make presentation clickers work.
- Each press shows the whole next slide: old content sweeps out with a quick red scan-wipe; new title, bullets and lower-third come in staggered; the banner wipes open last. Going back plays the same in reverse direction.
- URL hash tracks the slide (`/present#4`), so a refresh keeps the place.
- A top-bar link on the normal site ("Present", next to "Watch the intro") opens the deck.

## Constraints

- Existing stack: SvelteKit 2, Svelte 5 runes, TypeScript, `adapter-static` (prerendered), Vercel. Remotion 4.0.529 in `video/` (own install: `cd video && pnpm install --ignore-workspace`).
- `/present` uses the bare layout like `/intro` (no site top bar/footer), always dark.
- No new animation libraries (the intro story was built with CSS + JS only). A small QR library or a pre-generated QR SVG is acceptable; prefer generating it at build time from the deploy's own origin so preview builds point at themselves.
- `/` must not load any deck assets; banner videos load lazily (current slide and next).
- Fit at 16:9 projector sizes (1280×720 up to 1920×1080) with no overflow; text contrast AA against the stage.
- Owner rules from `HANDOFF.md`: no Claude attribution in commits; ask before `git push` (pushing `master` deploys production); never show invented numbers as real.
- Work on a new branch from `master` (the current checkout is `feat/d2`, unrelated).

## Calls made by Claude (owner to check)

- **QR and address on slide 9 always point at the production site**, taken from `VERCEL_PROJECT_PRODUCTION_URL` (the same origin `vite.config.ts` already uses for prerendering), so a QR shown from a preview build never lands students on a Vercel login wall.
- **All banner videos preload on the "Tap or press Space to start" screen** (they are small, silent loops), with a quiet progress indicator, so weak classroom wifi can't stall a slide mid-talk. Works the same from the live site or a local `pnpm preview`.
- The two figures only in `HANDOFF.md` ("0.82 on aquarium photos"; sound weak spots doorbell, car horn, footsteps) are typed to match it exactly.

## Timing

The owner wants it built today (2026-10-18). Build order is the builder's call; a working deck with poster stills in the banners first, then the loops, is the safe order.

## Left to the builder

- Component structure, file names, how slide content is stored (a typed slides data file is suggested).
- Exact animation timings and easings, within "calm stage, snappy content".
- Exact wording of slide copy, within the content listed above (short bullets, presenter-friendly).
- How the Remotion loops are organised (one composition per loop or one parametrised composition) and the render script changes.
- Tests: follow the repo's habits (unit tests for pure logic such as navigation/visible-slides; e2e for keys, hash, reduced motion, slide 7 hidden on a production build, no overflow at 1280×720).
