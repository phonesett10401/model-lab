# Model Lab — framework design

Date: 2026-09-27
Status: draft for review

## 1. Purpose

A public, interactive library ("Specimen Archive") of small AI models the owner trains, plus audits of models the owner attacks. Every entry carries an honest report card: what it was trained or tested on, how well it does per category, and how it fails.

This spec covers **the framework only**: design, layout, interaction, data model and quality bar. No real models are trained or integrated here. Models arrive later, one entry at a time, without changing the framework.

**Success:**
- The owner opens it on phone and laptop and loves both.
- A visitor (recruiter, engineer) understands what each entry does and how honest its report card is within seconds.
- Works at every viewport from 320px to 2560px+, portrait and landscape, light and dark.
- Adding a real model later = one data entry + one runtime file.

## 2. Scope

**In scope**
- Hero, index + workbench, per-entry pages, 404.
- Two entry kinds: **model** (live demo) and **audit** (write-up + replayable transcripts, no demo).
- Four model input types: **image, text, audio, table**. One output type: **labels with confidence**.
- All workbench states, report card, audit transcript viewer, light/dark themes, motion system.
- Placeholder content that never shows invented numbers.

**Out of scope (decided)**
- Training or integrating real models.
- Live chat / any chat UI that talks to a model. Chat and RAG systems are the owner's private practice targets; only their audits are published.
- Servers, APIs, databases, accounts, comments, community features.
- Video input (a later input type; the slot exists, nothing is built).
- Output types other than labels (added when a real model needs one).

## 3. Visual direction

**Specimen Archive** — a lab report and a natural-history archive crossed.

- **Light "paper" theme (default):** warm paper `#f5f3f2`, ink `#161212`, stamp red `#b3261e`, plates on `#ffffff` with hairline `#ddd6d4`.
- **Dark "evening archive" theme:** near-black `#141213`, ink `#f3eeee`, signal red `#ff4f4f`, plates on `#1d1a1b`. Designed, not an inverted light theme.
- Theme follows the device setting; a toggle overrides and is remembered.
- Red is used like an inspector's stamp: status stamps, the selected entry, prediction fill, flagged content. Never decoration.
- **Type:** Instrument Serif (entry names, headlines, top answer), Geist (body), JetBrains Mono (labels, data, numbers). Self-hosted via Fontsource; no runtime requests to Google.
- **Prediction bars** (from the "operator console" direction): mono label, thin track, red fill, percentage.
- Every text/background pair meets WCAG AA; checked by script for both themes.

## 4. Architecture

- **SvelteKit + Svelte 5 + TypeScript**, `adapter-static`, every route prerendered. Deployed to Vercel as static files.
- **Routes**
  - `/` — hero, then index + workbench. The selected entry lives in the URL: `/?entry=<slug>`.
  - `/models/[slug]` — a model's own page (demo + full report card).
  - `/audits/[slug]` — an audit's own page (write-up + transcripts + report card).
  - Custom 404 in the archive style.
  - Each entry page has its own `<title>`, description and Open Graph image for link previews (LinkedIn).
- **One data file**, `src/lib/entries.ts`, drives everything (§5).
- **Runtime slot:** each live model has one function `classify(input) → Promise<Prediction[]>`. Until a model exists, entries are not `live` and the workbench shows the "not live yet" state. Later, runtimes run in a Web Worker (transformers.js / ONNX Runtime Web) so the page stays smooth; inputs never leave the device.
- **Draft entries:** entries marked `draft: true` render in dev and Vercel preview deploys, never in production. Used to exercise every input type (text, audio, table) and the audit viewer before real ones exist.

## 5. Data model

```ts
type Status = 'live' | 'in-training' | 'planned';          // models
type AuditStatus = 'published' | 'in-progress' | 'planned'; // audits
type InputType = 'image' | 'text' | 'audio' | 'table';
type Measured = number | null;   // null renders as "—" / "not yet measured"

interface ReportCard {
  data: { label: string; value: string | null }[];          // source, size, split, base model, known gaps
  metrics: {
    title: string;                                           // "Accuracy per category" | "Attack success rate"
    lowerIsBetter?: boolean;
    rows: { label: string; value: Measured; before?: Measured }[]; // before = pre-defence, audits only
  };
  failures: Failure[];                                       // real mistakes only; empty until measured
}

interface ModelEntry {
  kind: 'model'; slug: string; no: number; name: string; purpose: string;
  status: Status; input: InputType; labels: string[];
  unsureBelow: number;                                       // top score under this → "unsure" state
  samples: Sample[];                                         // try-it inputs; at least one known failure
  report: ReportCard; draft?: boolean;
}

interface AuditEntry {
  kind: 'audit'; slug: string; no: number; name: string; purpose: string;
  status: AuditStatus; target: string;                       // what was attacked
  summary: string; transcripts: Transcript[];
  report: ReportCard; draft?: boolean;
}

interface Transcript {
  title: string; attackType: string;
  turns: { role: 'user' | 'assistant' | 'document'; text: string; flagged?: [number, number][] }[];
  verdict: 'defended' | 'broken'; defence?: string; note: string;
}
```

**Honesty rules (enforced by tests, §10):**
- A `live` model must have every metric row measured and at least one failure.
- A `published` audit must have measured metrics and at least one transcript.
- Non-live entries may not contain numbers in metrics.
- Everything illustrative (hero sample, drafts) is visibly labelled "sample".

**Initial production entries:** 01 Creature categorizer (image, planned), 02 Fresh or spoiled (image, planned), 03 Gender classifier audit (audit, planned). Plus drafts for text, audio, table and a filled audit to exercise the UI.

## 6. Layout (responsive)

Layouts respond to available space (container queries where a component's own width matters, viewport queries for page shells). Fluid type and spacing between breakpoints — no jumps.

| Width | Index | Workbench |
|---|---|---|
| < 640px (phone) | Stack of plates under the hero | Tap a plate → full-screen **sheet** slides up (swipe down / Back closes). Tabs: Demo · Data · Metrics · Fails. Input buttons pinned at bottom (thumb reach). "Open full page" link. |
| 640–1023px (tablet, split screen) | Horizontal snap strip of plates | Full width below: input and result side by side, report card in tabs. |
| 1024–1439px (laptop) | Sticky rail on the left | Demo always visible, report card in tabs below. Keyboard: ↑/↓ changes entry, Enter opens its page. |
| ≥ 1440px (wide) | Rail | Three columns: index · demo · full report card, no tabs. Content max ~1680px, centred. |

- Landscape phones / short viewports: the sheet becomes a side panel so input and result stay visible together.
- Index groups plates under **Models** and **Audits**; each plate shows number, input type or AUDIT, name, and a status stamp.
- Entry pages: the same components in one column, two columns from 1024px.
- Tap targets ≥ 44px. No horizontal page scroll at any width.

## 7. Components

- **Hero** — headline "See what it sees. *And where it's wrong.*" beside a specimen plate that cycles through sample inputs (photo, sentence, sound clip, chat excerpt with an injection highlighted), each "examined" with its own motion, prediction bars filling. Labelled SAMPLE. Static when reduced motion is on.
- **Plate** — entry card used in the index, strip, and as the morph source.
- **Stamp** — LIVE / IN TRAINING / PLANNED / PUBLISHED / AUDIT.
- **Workbench** — picks an input panel by `input`:
  - image: drop, paste, camera (`capture`), upload; formats JPG/PNG/WebP/HEIC.
  - text: textarea with character limit.
  - audio: record (MediaRecorder) or upload, waveform preview.
  - table: small form generated from the model's declared fields.
  - Plus **sample inputs** for instant trying, including one known failure.
- **PredictionBars** — top 3, serif top answer, spring animation, screen-reader text ("octopus, 94 percent").
- **ReportCard** — Data (key/value), Metrics (bars, worst first, "—" when unmeasured, optional before/after for audits), How it fails (examples; tapping one loads it into the demo for models).
- **TranscriptViewer** (audits) — step through attacks (◀ ▶), turns rendered as chat, retrieved documents as dashed "document" turns with flagged spans highlighted, annotation lines for ATTACK and DEFENDED/BROKEN with defence named. Read-only.
- **Sheet**, **ThemeToggle**, **Footer** (short method note, links).

## 8. Workbench states

1. **Ready** — empty input, sample inputs offered.
2. **Not live yet** — purpose shown, stamp, input disabled with reason. No fake predictions.
3. **Loading model** — real size and progress, "only the first time", "runs on your device". (Built now, used once runtimes exist.)
4. **Examining** — per-input motion over the visitor's own input: scan line (image), highlight sweep (text), playhead (audio), row sweep (table).
5. **Result** — top answer in serif, top 3 bars spring in.
6. **Unsure** — top score below `unsureBelow`: says it isn't confident, links to what it knows.
7. **Error** — unreadable file, too large, microphone/camera blocked, model failed to load. One plain sentence + way forward; previous result kept.

## 9. Motion

- **Plate → bench** morph on selection (Svelte `crossfade`); **bench → entry page** morph on navigation (View Transitions API via `onNavigate`; instant fallback where unsupported).
- **Stamp inks in** with slight overshoot. **Bars spring** (Svelte `Spring`), numbers count with them. **Outlines draw** once on first view (`draw`).
- Only `transform` and `opacity` animate. Nothing loops except the hero. `prefers-reduced-motion` → short fades, bars appear filled.

## 10. Quality checks

| Check | Covers | Tool |
|---|---|---|
| Data rules | Honesty rules in §5 for every entry | Vitest |
| Logic | unsure threshold, top-3 ordering, file type/size checks, input-panel selection | Vitest |
| Flows | select entry, run sample, open page, back button, phone sheet, keyboard nav, audit stepping, 404 | Playwright |
| Every size | 320, 375, 390, 768, 1024, 1280, 1440, 1920, 2560 + landscape phone; light + dark; assert no horizontal overflow | Playwright screenshots |
| Accessibility | axe scan, keyboard-only pass, visible focus, labels, contrast script | axe-core + manual |
| Speed | Lighthouse mobile: Performance ≥ 95, Accessibility 100, hero visible < 1.5s | Lighthouse |
| Owner review | each finished part shown at phone and desktop size before moving on | Vercel preview |

Target browsers: current and previous versions of Chrome, Edge, Safari (macOS + iOS), Firefox, Samsung Internet.

## 11. Open items (decided later, don't block this build)

- Video input design.
- Output types beyond labels.
- Where each real model's weights are hosted (static assets vs Hugging Face).
- Domain name.
