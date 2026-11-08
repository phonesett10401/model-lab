# Comic lettering round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Burmese sits only inside each original box, with only the English letters removed (the box's own background shows through), lines shaped to the box, and meaningful text on the art lettered in place with an outline.

**Architecture:** Three pure, unit-tested modules in `src/lib/comic/` do the pixel work: `bubbleShape` (rewritten to find the inside of any box by low local contrast, not by "light grey paper"), `letters.ts` (which pixels are letters, and an inpainting fill for them) and `shaped.ts` (Burmese lines whose widths follow the box's inside). `render.ts` is rewritten on top of them: erase every box first, then write all text. The page gets a `too-long` flag and leaves hand-marked sound effects alone; the evaluation and report card measure the new "fitted inside its box" share.

**Tech Stack:** SvelteKit 2 / Svelte 5, TypeScript, Canvas 2D, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-comic-lettering-round-2-design.md`

## Global Constraints

- The Burmese never goes outside its original box; no solid fill, no added frame or white box (owner: "texts should remain only in their original boxes, with transparent").
- Only letter pixels are changed; a bubble's outline and everything outside the box are never touched.
- Runs in the browser on the visitor's device; the page image never leaves it. No new npm dependency.
- A page of 10–15 boxes letters in about a second on the owner's laptop in a desktop browser; phones are not a target.
- Sound effects stay as drawn: an empty Burmese line is left untouched; boxes marked `sfx` by hand are not sent and not lettered ("Sound effects are left as drawn").
- Too long even at the floor size: stays inside, shown at the floor size, row flagged `too-long`: "The Burmese is longer than the space: shorten it or check it". Not retried automatically; "Retry flagged lines" asks for a shorter version.
- Usual minimum size is `fontRange(page.width).minSize`; floor is `Math.max(6, Math.round(page.width * 0.006))` (as now).
- Text colour: dark on light, light on dark (`inkFor`), from the box's background.
- Report card label: "Burmese fitted inside its box" = share of lettered boxes that fit at or above the usual minimum size.
- House style: sentence-case labels, no middle dots or glued arrows. Edits keep each file's line endings (LF; `src/lib/types.ts` is CRLF).
- Commits: no Claude co-author lines. e2e on `E2E_PORT=4180`; never port 4173.

## Review Focus

1. A box with no enclosed region (text on plain art, a bubble cut by the page edge): the box rectangle is the inside; only letters are erased; nothing is filled. Test in Task 4 (`text on the art is lettered in place without a box`).
2. A dark narration box with light letters: letters found and erased, Burmese drawn light. Test in Task 2 (`finds light letters on a dark box`) and Task 4.
3. A gradient bubble: the gradient continues under the erased letters. Test in Task 2 (`inpainting continues a gradient`).
4. Burmese far too long for a small bubble: drawn at the floor size inside the box and flagged, never spilling. Test in Task 3 (`too long stays inside at the floor`) and Task 5 (`a too-long line is flagged, not retried`).
5. A visitor changes a row's Burmese or kind after lettering: redraws from the original page (no erased-twice artefacts). Test in Task 4 (`edits redraw from the original`).

---

### Task 1: Find the inside of any kind of box

**Files:**
- Modify: `src/lib/comic/bubble.ts` (`bubbleShape`)
- Test: `src/lib/comic/bubble.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `bubbleShape(px: Uint8ClampedArray, w: number, h: number, seed?: Box): { color: string; mask: Uint8Array; inside: Uint8Array; inner: Box; loose: Box } | null` — `inside` (new) is the box's inside without letters (1 = background pixel inside the outline); `mask` stays "inside + letters" (what may be repainted); `color` is the average background colour (`rgb(r,g,b)`). `bubbleExtent` and `whitenOutside` keep their signatures and use it.

- [ ] **Step 1: Write the failing tests** (keep every existing `bubble.test.ts` test)

```ts
it('finds the inside of a tinted, a gradient and a dark box', () => {
	for (const [name, paint] of [
		['tinted', (y: number) => [250, 235, 190]],
		['gradient', (y: number) => [255 - y, 255 - y, 255]], // top white, bottom light blue
		['dark', (y: number) => [30, 30, 40]]
	] as const) {
		const { px, w, h } = ellipse(paint, { letters: name === 'dark' ? [240, 240, 240] : [0, 0, 0] });
		const s = bubbleShape(px, w, h)!;
		expect(s, name).not.toBeNull();
		expect(s.mask[40 * w + 50], `${name}: letter`).toBe(1);
		expect(s.inside[40 * w + 50], `${name}: letter is not background`).toBe(0);
		expect(s.mask[40 * w + 9], `${name}: outline`).toBe(0);
		expect(s.mask[1 * w + 1], `${name}: art outside`).toBe(0);
	}
});
```
(`ellipse(paint, { letters })` is a test helper in this file: the same 100×80 ellipse as the existing tests, outline black, art grey 110 outside, the paper painted row by row by `paint(y)`, a 30×8 bar of letters in the middle.)

- [ ] **Step 2: Run** `pnpm vitest run src/lib/comic/bubble.test.ts` — Expected: the new test FAILS (tinted/dark return null); the old ones pass.

- [ ] **Step 3: Implement** the inside as the region connected to the seed through **low local contrast**: a pixel joins if its colour differs from its already-inside neighbour by at most a small step (gradients pass, letter edges and outlines stop it), instead of "near one light paper colour". Keep the gap closing (`GAP`), the hull rule and `inscribed`. `inside` = that region; `mask` = `inside` plus the letters it encloses (as today). Drop the luminance ≥ 150 and saturation rules; a coloured light patch is still kept out because it is not connected to the seed by low contrast through the outline.

- [ ] **Step 4: Run** `pnpm vitest run src/lib/comic` — Expected: all comic unit tests PASS (the old "white paper, not a coloured light patch" test included).

- [ ] **Step 5: Commit** `feat(comic): find the inside of any kind of box (tinted, gradient, dark), not only white paper`

### Task 2: Which pixels are letters, and fill them from the background

**Files:**
- Create: `src/lib/comic/letters.ts`
- Test: `src/lib/comic/letters.test.ts`

**Interfaces:**
- Consumes: `bubbleShape(...).inside` / `.mask` from Task 1.
- Produces:
  - `letterPixels(px: Uint8ClampedArray, w: number, h: number, area: Uint8Array): Uint8Array` — 1 for pixels in `area` that are letters (contrast to the local background), grown by 1–2 px to take the anti-aliased edge.
  - `inpaint(px: Uint8ClampedArray, w: number, h: number, hole: Uint8Array): void` — fills `hole` pixels in place from the surrounding non-hole pixels; never changes a pixel outside `hole`.

- [ ] **Step 1: Write the failing tests**

```ts
it('finds dark letters on light paper and light letters on a dark box', () => { /* both: every letter pixel 1, paper pixels 0 */ });
it('finds light letters on a dark box', () => { /* explicit dark-box case */ });
it('inpainting fills a flat box with its paper colour', () => { /* max channel error ≤ 2 */ });
it('inpainting continues a gradient', () => { /* each filled pixel within 6 of the true gradient value at its row */ });
it('inpainting never changes a pixel outside the hole', () => { /* compare every non-hole pixel before/after */ });
```

- [ ] **Step 2: Run** `pnpm vitest run src/lib/comic/letters.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `letterPixels` (local background from the area's surroundings, threshold on colour distance, dilate 1–2 px) and `inpaint` (onion-peel: repeatedly fill hole pixels on the hole's edge with the average of their known neighbours until none remain). Keep it allocation-light: typed arrays, one pass list per ring.

- [ ] **Step 4: Run** `pnpm vitest run src/lib/comic/letters.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(comic): find letter pixels and fill them from the box's own background`

### Task 3: Burmese lines shaped to the box

**Files:**
- Create: `src/lib/comic/shaped.ts`
- Test: `src/lib/comic/shaped.test.ts`

**Interfaces:**
- Consumes: `wrapBurmese`'s word/syllable breaking from `fit.ts` (export the segment helpers it needs, or reuse `wrapBurmese` per line width).
- Produces: `fitShaped(text: string, spans: ([number, number] | null)[], top: number, measure: (s: string, size: number) => number, opts: { maxSize: number; minSize: number; floor: number; lineHeight: number }): { size: number; lines: { text: string; x: number; y: number }[]; fits: 'fit' | 'small' | 'too-long' }` — `spans[i]` is the inside's `[left, right]` at row `top + i` (null where the row has no inside); lines are centred horizontally in their own row's span and the block centred vertically; `fits` is `'fit'` at or above `minSize`, `'small'` between `floor` and `minSize`, `'too-long'` when even `floor` does not fit (then lines are laid out at `floor`, still inside the spans, and the overflow is cut).

- [ ] **Step 1: Write the failing tests**

```ts
it('lines follow an ellipse: middle lines longer than the top and bottom ones', () => { /* spans of an ellipse; ≥ 3 lines; width(middle) > width(first) and > width(last) */ });
it('every line stays inside its row span', () => { /* for each line: x ≥ left and x + measured width ≤ right at every row the line covers */ });
it('uses a bigger size than the inscribed rectangle would', () => { /* same text: fitShaped size > fitText(size) in the inscribed rectangle */ });
it('too long stays inside at the floor', () => { /* fits === 'too-long', size === floor, all lines inside spans */ });
```

- [ ] **Step 2: Run** `pnpm vitest run src/lib/comic/shaped.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `fitShaped`: for each size from `maxSize` down to `floor`, lay lines top to bottom where each line's width is the narrowest span over the rows that line occupies; accept the first size whose lines all fit, centring the block in the spans' vertical extent.

- [ ] **Step 4: Run** `pnpm vitest run src/lib/comic/shaped.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(comic): Burmese lines shaped to the box's inside`

### Task 4: Letter the page: erase letters only, then write all text

**Files:**
- Modify: `src/lib/comic/render.ts` (rewrite `renderPage`)
- Modify: `src/lib/comic/erase.ts` (remove `eraseStyle`; keep `inkFor`), `src/lib/comic/erase.test.ts`
- Modify: `src/lib/components/ComicTranslator.svelte` (uses the new return value)
- Test: `e2e/comic.e2e.ts`, `e2e/comic-fake.ts` (a gradient-bubble page and a dark-caption page helper)

**Interfaces:**
- Consumes: Task 1 `bubbleShape`, Task 2 `letterPixels` / `inpaint`, Task 3 `fitShaped`, `inkFor`.
- Produces: `renderPage(ctx, page, regions): Promise<{ modes: Record<number, 'fit' | 'small' | 'too-long'> }>` — the page reads `modes` for `data-mode` and for the `too-long` flag (Task 5).

- [ ] **Step 1: Write the failing e2e tests** (keep every existing lettering test; update `keeps the bubble outline…`, `a long translation keeps the bubble outline`, `a bubble the finder calls a caption keeps its outline too` only where they assert the old flat fill)

```ts
test('a gradient bubble keeps its gradient where the letters were', ...)   // pixel between letters equals the original; a former letter pixel is within 8 of the gradient
test('a dark caption keeps its colour and gets light Burmese', ...)        // background pixel unchanged; drawn text pixels are light
test('text on the art is lettered in place without a box', ...)            // cls art-text: no pixel outside the original letters' area changes except the new text and its outline
test('nothing outside a box ever changes', ...)                            // whole-canvas diff limited to the boxes
test('edits redraw from the original', ...)                                // change the Burmese twice; the result equals a fresh render of the second text
```

- [ ] **Step 2: Run** `E2E_PORT=4180 pnpm exec playwright test e2e/comic.e2e.ts --project=chromium -g "gradient|dark caption|in place|outside a box|redraw"` — Expected: FAIL.

- [ ] **Step 3: Rewrite `renderPage`**: draw the page; pass 1, for every region with Burmese: crop the box, `bubbleShape` (bubbles and captions; for `art-text` or no shape, the inside is the whole box), `letterPixels` on the inside area, `inpaint` those pixels, put the crop back, and record the inside's row spans; pass 2: `fitShaped` per region and draw its lines with `inkFor(shape color or the box's average)`; `art-text` lines get a 2 px outline in the opposite colour (`strokeText` before `fillText`). Regions with empty Burmese or `cls === 'sfx'` are skipped. Remove the `grown`/`cover` paths and their white boxes.

- [ ] **Step 4: Run** the comic e2e suite in both browsers: `E2E_PORT=4180 pnpm exec playwright test e2e/comic.e2e.ts` — Expected: all PASS. Then letter the owner's flagged pages with stand-in Burmese (`node .superpowers/bench/bubble-shot.mjs <page> <out.png>` with the dev server on 4182: Pepper&Carrot 39-06, 39-08, 39-09, 39-11, Black Jack v02-011, v02-099) and look at each.

- [ ] **Step 5: Commit** `feat(comic): letter inside the original box only: letters erased, background kept, lines shaped to the box, text on the art outlined`

### Task 5: Too-long flag, sound effects left alone, "shorter please"

**Files:**
- Modify: `src/lib/comic/types.ts` (CRLF: `LineProblem` adds `'too-long'`; `SentLine` adds optional `short?: true`)
- Modify: `src/lib/comic/translate-server.ts` (`validateLines` accepts 4 keys, or 5 with `short: true`; `buildPrompt` marks those lines and adds the instruction)
- Modify: `src/lib/components/ComicTranslator.svelte` (`PROBLEMS['too-long']`, set from `modes`; `sent` leaves out `sfx` rows; the row note; `translate(true)` sends `short: true` for `too-long` rows; `too-long` not in `SLIPS`)
- Test: `src/lib/comic/translate-server.test.ts`, `e2e/comic.e2e.ts`

**Interfaces:**
- Consumes: Task 4 `modes`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing tests**

```ts
// translate-server.test.ts
it('a line asked to be shorter is marked in the prompt', () => {
	const p = buildPrompt([{ ...line, short: true }]);
	expect(p.user).toContain('[shorter]');
	expect(p.system).toContain('[shorter]');
});
it('accepts short: true and nothing else extra', () => {
	expect(validateLines({ lines: [{ ...line, short: true }] })).not.toBeNull();
	expect(validateLines({ lines: [{ ...line, short: 'yes' }] })).toBeNull();
});
```
```ts
// e2e
test('a too-long line is flagged, not retried', ...)       // fake Burmese far too long → problem text 'The Burmese is longer than the space: shorten it or check it'; exactly 1 request
test('retrying a too-long line asks for a shorter one', ...) // click Retry flagged lines → the request body has short: true for that line
test('a box marked as a sound effect is not sent and not lettered', ...) // select Kind sfx → row says 'Sound effects are left as drawn'; body has no such line; pixels unchanged
```

- [ ] **Step 2: Run** the new tests — Expected: FAIL.

- [ ] **Step 3: Implement** as in Files. Prompt line for `short`: `'Lines marked [shorter] came out too long for their space: give a shorter Burmese line with the same meaning.'` in the system text and the `[shorter]` tag on the line in the user text.

- [ ] **Step 4: Run** `pnpm vitest run` and `E2E_PORT=4180 pnpm exec playwright test e2e/comic.e2e.ts` — Expected: all PASS.

- [ ] **Step 5: Commit** `feat(comic): too-long Burmese is flagged and can be retried shorter; boxes marked as sound effects are left as drawn`

### Task 6: Measure it: evaluation, report card, checks

**Files:**
- Modify: `src/lib/comic/score.ts` (`fitShare(modes: ('fit' | 'small' | 'too-long')[]): number | null` = share of `'fit'`), `src/lib/comic/score.test.ts`
- Modify: `eval/comic.eval.ts` (mode type), `src/lib/entries.ts` (label "Burmese fitted inside its box"), `e2e/comic.e2e.ts` (report-card label test)
- Modify: `src/lib/data/comic-translator-pipeline.json` and `static/samples/comic/*` (regenerated), `docs/superpowers/HANDOFF.md`

**Interfaces:**
- Consumes: Task 4 modes.
- Produces: the report card's new numbers.

- [ ] **Step 1: Write the failing test** `fit share counts only boxes that fit at the usual size` — `fitShare(['fit','fit','small','too-long']) === 0.5`.
- [ ] **Step 2: Run** `pnpm vitest run src/lib/comic/score.test.ts` — Expected: FAIL (type/values).
- [ ] **Step 3: Implement** the type and label changes.
- [ ] **Step 4: Dry run** `COMIC_EVAL_FAKE=1 pnpm eval:comic` — Expected: `1 passed`; `pipeline.json` has `fit` between 0 and 1. Then the real run when the owner's free Gemini quota allows (about 110 of 500 daily requests): move `training/runs/comic/eval-pipeline` aside, `pnpm eval:comic`, commit the regenerated JSON and samples. Never edit `src/` while it runs.
- [ ] **Step 5: Gates** `pnpm check` (0 errors), `pnpm vitest run` (all pass), `E2E_PORT=4180 pnpm exec playwright test` (comic, archive, assistant pass), `VERCEL_ENV=production pnpm build`; light/dark/375 px look at `/comic-translator` and `/models/comic-translator`. Update the HANDOFF's comic section.
- [ ] **Step 6: Commit** `feat(comic): report card measures Burmese fitted inside its box; lettering round 2 measured`
