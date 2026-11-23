# Comic lettering, round 2: Burmese that sits in the box like the original

Date: 2026-10-26. Owner: Phone Sett. Part of the comic translator (`docs/superpowers/specs/2026-10-24-comic-translator-design.md`); the finder's training is a separate design (`2026-10-26-comic-finder-round-3-design.md`).

## Why

Today (`src/lib/comic/render.ts`, `bubble.ts`, `fit.ts`) the page paints the inside of a bubble one flat paper colour, puts the Burmese in the largest rectangle that fits inside the bubble, and, when text does not fit or there is no bubble, draws a white box (with a black frame for text on the art). On bubbles or narration boxes with a gradient, texture or tint the flat fill shows; the rectangle wastes the rounded parts of an oval, so the type is smaller than it could be; and text on the art gets a pasted-on white box.

## Goal (the owner's words, 2026-10-26)

"Texts should remain only in their original boxes, with transparent": the Burmese stays **inside its original box** (bubble, narration box, or the area of the original text on the art), and only the **English letters are removed**, so the box's own background shows through: no solid fill, no added frame.

## What it does

1. **Erase only the letters.** Inside the box, find the pixels that belong to the English letters (strokes that differ from the local background, plus their anti-aliased edge) and fill just those from the surrounding background (inpainting), so flat paper, gradients and soft textures continue under where the letters were. The outline of a bubble and everything outside the box are never touched.
2. **Text shaped to the box.** Lines follow the box's shape: each line's width is the width of the box's inside at that line's height (short lines at the top and bottom of an oval, long in the middle; the right shape for jagged shouts, clouds and rectangles). The largest type size that fits is used, as today down to a floor, and the block is centred in the box's inside.
3. **Meaningful text on the art** (`free-text` from the new finder; today `art-text` boxes that are not sound effects): erase the letters the same way, then letter the Burmese in the original text's area with a thin contrasting outline (light text with a dark outline on dark art and the reverse), so it reads without a box.
4. **Text colour** follows the original: dark text on light paper, light on dark (as `inkFor` does now), taken from the original letters where possible.

## Constraints

- Everything runs in the browser, on the visitor's device (the page image never leaves it).
- The Burmese never goes outside its original box. If it cannot fit even at the floor size, it stays inside, shown at the floor size, and the row is flagged ("The Burmese is longer than the space: shorten it or check it") rather than spilling or adding a box.
- A page of 10–15 boxes letters in about a second on the owner's laptop in a desktop browser. Phones are not a target (owner, 2026-10-26).
- Sound effects stay as drawn (unchanged).
- Same honesty rules: the "fitted without covering the art" number on the report card is redefined as "fitted inside its box at or above the usual minimum size" and measured again with `pnpm eval:comic` (stand-in translations first, then a real run when the free quota allows).

## Non-goals

- Perfect inpainting under text drawn over detailed art (faces, hatching): small smudges there are acceptable; the row's OCR text and Burmese stay editable.
- Matching the original lettering's font or hand style.

## Measuring

- Unit tests on synthetic boxes: letters removed and background kept (flat, gradient, textured); outline untouched; line widths follow an ellipse; text never outside the box.
- Visual check on the pages the owner flagged (Pepper&Carrot 39-06, 39-08, 39-09, 39-11, Black Jack v02-011, v02-099, the Monday Munches sample) with stand-in Burmese, light and dark site themes, and phone width.
- Report-card numbers re-measured as above.

## Calls made after the builder check (Claude's, for the owner to check)

- **Any kind of box, not only white paper.** The owner asked for text fitted "inside original oval or any kinds of text boxes", so the shape finder (`bubbleShape`, used by lettering, `growToBubbles` and the OCR clean-up) learns tinted, gradient, textured and dark bubbles and narration boxes: the inside is the region enclosed by the box's outline (or the box's own fill, when it has no outline), not "light grey paper". Its existing tests stay and new ones cover those cases; growing and OCR clean-up are re-checked on the flagged pages. Where no enclosed region is found, the found rectangle is the inside (letters still erased only, nothing filled).
- **"Too long" is its own flag, not a translation slip.** A new line problem `too-long` ("The Burmese is longer than the space: shorten it or check it") marks the row but is **not** retried automatically (so nothing loops); "Retry flagged lines" asks Gemini for a shorter version of those lines (a hint in the request), and editing the Burmese clears it. `renderPage` returns which rows did not fit, alongside `modes`.
- **Text on the art now, without waiting for the finder.** Today's `art-text` boxes are lettered on the art with the outline style when their Burmese is not empty; a sound effect already comes back empty from Gemini ("leave as drawn") and is left untouched. The class is renamed `free-text` when the new finder ships.
- **Boxes marked `sfx` by hand** are not sent to Gemini and not lettered; the row says "Sound effects are left as drawn". Changing its kind sends it like any other row. They are not counted on the report card.
- The `grown` and `cover` lettering modes go away; "usual minimum size" is `fontRange().minSize`.

## What's left to the builder

- The inpainting method (for example a fast marching / diffusion fill in a small module, without a new heavy dependency).
- How letter pixels are told apart from the background (contrast to the local background, stroke width, dilation).
- The line-breaking details for shaped lines (Burmese breaks at word and syllable boundaries, as `wrapBurmese` does).
- The outline width and colour rule for text on the art.
