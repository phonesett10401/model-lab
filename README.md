# AI Model Lab

**Small AI models, and where they're wrong.**

A library of small, single-purpose AI models I train. Every model comes with an honest report card: what it was trained on, how accurate it is per category, and the specific cases where it fails.

Models run **in the visitor's browser**. Nothing you upload leaves your device, and the site needs no server.

## Status

The framework is built. The real models are not trained yet.

| No. | Entry | Type | Status |
|---|---|---|---|
| 01 | Creature categorizer | image model | planned |
| 02 | Fresh or spoiled | image model | planned |
| 03 | Gender classifier (bias study: accuracy reported per group) | image model | planned |

Draft entries (text, audio, table and a sample audit) exercise every part of the interface. They show in local dev and preview deploys and are compiled out of production builds. Audits are also hidden on production for now.

## Honesty rules

These rules are enforced by tests, not by convention (`src/lib/validate.ts`):

- **No invented numbers.** An unmeasured value renders as "—" or "not yet measured". A planned model cannot contain a metric.
- **A model can only be marked live if its report card is complete:** measured metrics, at least one real failure, and a sample it gets wrong.
- **"Unsure" is an answer.** Below a set confidence the demo says it isn't sure instead of picking a winner.
- **Anything illustrative is labelled** SAMPLE or DRAFT.

## Run it

Built with Node 24 and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

```bash
pnpm check          # type check
pnpm test:unit --run
pnpm exec playwright install chromium webkit   # once
pnpm test:e2e       # builds, then runs the browser tests in Chromium + WebKit
pnpm build          # static site in build/
```

## How it works

- **SvelteKit + Svelte 5 + TypeScript**, prerendered to static files (`adapter-static`) and deployed to Vercel.
- **One data file drives everything:** `src/lib/entries.ts`. Each entry declares its kind, status, input type (image, text, audio or table), labels and report card.
- **Pages:** `/` shows the hero, the archive index and the workbench; the selected entry is kept in the URL (`/?entry=…`). Each entry also has its own page at `/models/<slug>` or `/audits/<slug>`, with a link-preview image.
- **Runtime slot:** a live model provides one `classify(input)` function (`src/lib/runtime/`). The rest of the site doesn't change when a real model arrives.
- **Layout adapts to every size:** a phone sheet, a tablet strip, a laptop split and a wide three-column bench, in a light paper theme and a dark evening theme.

## Adding a real model

1. Train it and measure it on held-out test data.
2. Fill in its entry in `src/lib/entries.ts`: real metrics, real failures, and samples, including one it gets wrong.
3. Register its runtime in `src/lib/runtime/index.ts`.
4. Set its status to `live`. The tests refuse the change if anything above is missing.
5. Regenerate the link-preview images with `pnpm build`, then `pnpm preview --port 4173` and, in another terminal, `pnpm og`.

## Design docs

- Spec: [docs/superpowers/specs/2026-09-27-model-lab-framework-design.md](docs/superpowers/specs/2026-09-27-model-lab-framework-design.md)
- Build plan: [docs/superpowers/plans/2026-09-27-model-lab-framework.md](docs/superpowers/plans/2026-09-27-model-lab-framework.md)
