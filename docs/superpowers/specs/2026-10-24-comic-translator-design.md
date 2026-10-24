# Comic translator (English → Burmese): design

Date: 2026-10-24. Status: draft for the owner's review. No code until approved.

## Why

The owner is building this for **MandaX**, a platform where Burmese artists post and sell their work. Some of those artists draw comics in English; this tool makes a Burmese edition for local readers. It lives on **AI Model Lab** (not inside MandaX) so MandaX can try it first.

The twist, agreed with the owner: **artists' comic pages are never given to an outside AI.** The work is split in two:

- **Part 1 (on the artist's device, in the browser):** find the English text, read it, and later check the translation, erase the English and letter the Burmese back in.
- **Part 2 (outside service):** translate the page's text to proper Burmese. It receives text only, never an image.

## Goals

1. Version 1 target, in the owner's words: **be able to replace every English text on manga-style pages first.** Panelled pages are the main case; page shapes from MandaX are not known yet, so tall webtoon strips must not break the tool (see Layout handling), but they are not tuned for.
2. Every piece of English on the page is found: speech bubbles, captions, sound effects, and other text drawn in the art (signs, notes).
3. The Burmese reads naturally (polite and gendered endings follow the speaker) and fits where the English was.
4. An honest report card: every number is measured; anything unmeasured shows "not yet measured".

## Non-goals (version 1)

- Whole-book PDF export (**wanted later**, owner asked to keep it on the list).
- CBZ / zip comic files.
- Our own OCR model (approach C below); only if the OCR scores show it's needed.
- AI repainting of art under removed text.
- Other languages, MandaX integration, accounts, passcodes.
- Tuning for tall webtoon strips.

## Anti-goals (a failure even if it "works")

- Any comic image leaving the visitor's device.
- Any made-up or typed-in score.
- Zawgyi encoding, or broken stacked Burmese characters, in the output.
- Training on comics we have no clear right to use (see Data).
- Real artists' text going through Gemini's free tier.

## Decisions made with the owner

- **Lives on the lab**, public, **no passcode.**
- **Translator: Gemini**, default model `gemini-3.5-flash` (owner's choice). The model name is a setting, so it can change in one place, and the translation step is written so another LLM (e.g. Claude) can be compared on the same pages later.
- **Free tier for testing** on public-domain / openly licensed pages only. **Switch to a paid Gemini plan before any real artist's comic is translated**: free-tier inputs may be used by Google, paid ones are not. The page states which tier is in use.
- **Enforcing the free-tier rule:** no gate in code (owner: the site has no real visitors yet). The page states the tier, and the owner and MandaX simply don't upload real artists' pages until the paid plan is on. Revisit if the site gets real traffic.
- **Approach B:** we train our own text-region detector; a ready-made English OCR reads each region in the browser; Gemini repairs OCR slips from context.
- **Detector licence (owner chose):** a detector with a free commercial licence (Apache-2.0 or MIT, e.g. D-FINE or YOLOX), **not Ultralytics YOLO (AGPL-3.0)**, so MandaX can use the model later. This means a new training pipeline and a new in-browser decoder instead of reusing `yolo.ts`; the ONNX Runtime Web loading pattern (`static/models/`, `?url` wasm) is still reused. The builder picks the detector by measuring two candidates on validation pages, and it must export to ONNX and run in the browser. The label format is kept tool-neutral (e.g. COCO JSON) so a later switch costs a retrain, not relabelling.
- **Layout B, one workspace** (owner: "B is better to test"): original and Burmese side by side, the bubble list below.
- **Burmese judge:** the owner, on about 20 frozen test pages.
- **Training data:** only public-domain or openly licensed comics, plus synthetic pages, plus MandaX artists' pages **only with written opt-in consent** (separate from using the translator; withdrawable).
- Input: single images (PNG, JPG, WebP) and PDF.
- Output: download each page as PNG.

## How a page is translated

1. **Open.** The visitor drops in an image or a PDF; a PDF is split into page images in the browser.
2. **Find.** The detector draws numbered boxes on every text region, with a class: `bubble`, `caption`, `sfx`, `art-text`. The visitor can delete a wrong box or draw a missed one.
3. **Read.** OCR reads each box in the browser. Boxes are put in reading order (rows top to bottom, then left to right; *my call*, a manga right-to-left switch is a builder option). The visitor can fix the English in the bubble list.
4. **Send.** One request per page to our Vercel function, which calls Gemini. The request holds only numbered English lines, each with an optional speaker the visitor picks (man / woman / child / narrator / unknown) and the region class. A yellow **"Sent to Gemini (text only)"** box shows exactly this.
5. **Check.** Gemini must return the same numbered lines as JSON. Part 1 checks: every number came back, none missing or extra; each line is Burmese script (Myanmar Unicode block, no Zawgyi); length ratio is within a sane range. Failures turn red in the list; the visitor can retry that line or type their own.
6. **Letter it in.**
   - Erase: inside a plain bubble, fill the text area with the bubble's own colour (sampled); on art (`caption` on art, `sfx`, `art-text`), the covering box is used.
   - Wrap Burmese at word breaks with `Intl.Segmenter('my', { granularity: 'word' })`; font **Noto Sans Myanmar** (OFL, self-hosted), drawn on canvas.
   - Fit order: shrink font down to a readable minimum → re-wrap → grow the box inside the bubble → only then a covering box that overlaps the art (the owner's idea, last resort). Leave room for marks above and below the line (Burmese is taller).
7. **Save.** Download each page as PNG.

The public page also shows 2–3 finished before/after examples (from openly licensed pages), so visitors see the result without using quota.

## Page (layout B)

- Left: original with numbered boxes ("stays on your device"). Right: the Burmese page.
- Below: the bubble list (number, class, speaker, English, Burmese, edit, status) and the yellow "Sent to Gemini" box.
- Buttons: Translate page, Download PNG. A clear message when the daily limit is reached ("today's translations are used up, try tomorrow"), examples still shown.
- Lab rules apply: Light / Dark themes, no horizontal overflow at phone width, nothing loads until the visitor uses it.

## Translation service (Part 2)

- A **Vercel function** in the same project (root `api/` folder; the site stays `adapter-static`). It holds `GEMINI_API_KEY` from Vercel environment variables; the key is never in the browser or the repo. Local key file: `.env` (git-ignored, already made in the working folder; never print or commit it).
- It accepts **text only**: JSON of numbered lines, a size limit per request, and requests from the lab's own origin. Anything else is rejected. It never accepts image data.
- **Cost guard:** Google's own quota is the hard cap (free tier stops at its daily limit; on the paid plan, set a daily request limit in Google's console). No counting code of our own.
- Prompt: whole page in reading order, speakers and classes given, ask for natural spoken Burmese, endings matched to speaker, sound effects as Burmese sound words, JSON out with the same numbers.
- First build step: a tiny check that the key works and `gemini-3.5-flash` is available on the current tier (never prints the key). If not available free, test on the newest free Flash model.

## Data

Every training and test page is logged (source, licence, URL, date) like `training/attribution/sea-v2.csv`. Check each source's licence page **before** downloading. Commercial use must be allowed (MandaX is a business), so **NC and academic-only sources are out**; **CC BY-SA is out** unless the owner decides otherwise (unsettled whether share-alike reaches a trained model).

| Source | Use |
|---|---|
| Pepper&Carrot (David Revoy, CC BY 4.0) | modern colour comic with English; text on separate layers in the source files → near-free labels; art-only files for synthetic pages |
| Black Jack ni Yoroshiku (Shūhō Satō; free reuse incl. commercial and translation since 2012, confirm current terms) | real manga art and bubble shapes; we can letter **English** into its bubbles ourselves → English-on-manga pages with exact labels |
| Korean public-body webtoons under KOGL Type 1 | modern manhwa shapes (titles still to find) |
| CC BY / CC0 pages from Wikimedia Commons, Fodongo zine, others | modern Western variety |
| Digital Comic Museum (public domain, 1940s–50s) | lots of English lettering, good for OCR tests |
| Synthetic pages | our own bubbles and English text on the art-only pages above; labels are exact |
| MandaX artists (opt-in, written consent) | real target style; can also be used for **local testing only** if an artist agrees to testing but not training |

Excluded: Manga109 (academic only; a commercial subset exists but terms unconfirmed), eBDtheque, COMICORDA, most webcomics (NC).

Labelling (**changed 2026-10-24, owner's decision**: no hand labelling): labels are made automatically, English words found by an OCR (docTR, Apache-2.0, run locally) and shaped and typed by our round-1 detector's boxes; Pepper&Carrot also uses exact bubble outlines from its text-vs-art comparison. Claude reviews every test and validation page by eye and drops pages whose labels are clearly wrong. The report card must say: test labels are machine-made and reviewed by Claude, not by a person. **True text for OCR scoring** (*my call*): synthetic pages, Pepper&Carrot text layers and Black Jack pages we letter in English ourselves already carry their exact text, so they need no typing; for old public-domain test pages the OCR drafts the text and the owner corrects about 10 pages. The report card says which pages each number covers. Split train / validation / **frozen test**, test held back from the start. Size: *my call* several hundred labelled pages; the builder sets the exact number after a first pass.

## Report card (measured only)

- **Finding text:** precision, recall, mAP@50 per class, on frozen test pages, reported separately for **manga-style**, **modern Western**, and **old (public domain)** pages, so the style gap is visible.
- **Reading text:** OCR character error rate, before and after Gemini's repair.
- **Translation:** owner's per-bubble score on ~20 test pages (correct / understandable / wrong, plus "ending fits speaker" yes/no). Same pages and scoring for any model comparison.
- **Fitting:** share of bubbles that fit without the overlap fallback (counted automatically).
- **"Every English text replaced":** share of test-page English regions that end up erased and replaced (the version 1 goal as one number).

## Layout handling

Panelled pages are the target. For tall pages (height much greater than width), the detector runs on overlapping square tiles and merges boxes, so webtoon strips work, untuned. *My call*, cheap enough to include.

## Hard rules (repeat)

Images never leave the browser. The function takes text only. Free tier only for open-licence pages. Paid plan before real artists. No key in browser or repo. No invented numbers. No Claude attribution in commits. Don't push master without asking; another session runs evaluations on master (don't use port 4173 or the eval runner).

## Build order (*my call*, no MandaX date yet)

1. Translate-and-letter with boxes the visitor draws by hand (tests Gemini, the check step and Burmese lettering early, needs no trained model).
2. Data and labelling, then train the detector.
3. Detector + OCR in the page, then the report card.

## Left to the builder

- Which ready-made OCR runs in the browser (must be openly licensed, run offline in the browser, handle all-caps lettering); measure two candidates on the test pages and pick by score.
- Which ready-made detector drafts the labels (draft only, not shipped).
- Detector size (speed vs accuracy on a mid phone), exact thresholds, length-ratio bounds, minimum font size.
- Route and entry shape in `src/lib/entries.ts` (likely `/models/comic-translator`), and whether the function is TypeScript or JavaScript.
- PDF splitting library (must run in the browser).
