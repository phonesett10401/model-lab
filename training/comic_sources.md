# Comic finder round 3: sources

Every source considered for training the round 3 text finder, its licence status, style, how it maps to the one
labelling target (`bubble`, `caption`, `free-text`, `sfx`; see `comic_common.CLASSES`) and whether it is kept.
Pages of sources whose art belongs to publishers stay in `training/data/comic3` (git-ignored) and a private Kaggle
dataset: never committed, never shown on the site (owner, 2026-10-25). Import with `python comic_import.py <source> <folder>`.

| Source | Style | Licence status | Labels → target | Status |
|---|---|---|---|---|
| Kaggle `naufalahnaf17/manga-text-detection` | manga (Indonesian scanlations) | Apache 2.0 (labels); publishers' art | text boxes (`textrotation`) → grown to their bubble; a page with any box that doesn't grow (24% of boxes: sound effects, spiky or panel-crossing bubbles) is left out whole, so no bubble is left unlabelled | **kept** (2026-11-02): 120 of 450 pages, 560 bubbles |
| Kaggle `swm16a4/mangatextbox-detection` | manga (Japanese) | unknown; publishers' art | `text_bubble` → bubble (already whole bubbles); `clean_text` and `messy_text` left out (growing `messy_text`, text on the art and big sound effects, took pale art) | **kept** (2026-11-02): 543 pages, 2,517 bubbles |
| Kaggle `gamingartist2345/speech-bubble-masks` | manga (Japanese) | unknown | masks | **dropped** (2026-11-02): 998 of 1,026 images are 1654×1170 two-page spreads of 1990s manga, i.e. Manga109, which the owner declined; local copy deleted |
| Kaggle `hieupham154/lie-eater-speech-bubbles` | manga (English edition of *Usogui*, not a webtoon) | MIT (from Roboflow CC BY 4.0); publishers' art | `bubble` → bubble (whole bubbles) | **kept** (2026-11-02): 399 pages after removing Roboflow's augmented copies (1,147 files), 2,375 bubbles |
| Kaggle `aasimsani/ampd-base` (AMP-D) | synthetic manga | LGPL 3.0 | generated bubbles | **not downloaded**: 11.5 GB of synthetic pages with Japanese text; our own synthetic pages (Task 4) come first |
| Roboflow `crepidules-workspace/manga-bubble-detection` | manga | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export (owner) |
| Roboflow `moon-6f9b2/cg-manhua-bubbles-10k` | manhua | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export |
| Roboflow `comic-speech-bubbles/comicbubbles` | modern Western | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export |
| Roboflow `testspace-r2sxk/webtoon-bbox-detection` | webtoon | licence not shown on the page; check the export; publishers' art | `bubble` → bubble, `onomatopoeia` → sfx, `other` left out | waiting: Roboflow export (owner) |
| Roboflow `wip-sama-wip-sama-smastermega/webtoon-segmented` | webtoon | CC BY 4.0 (labels); publishers' art | `balloon-*` → bubble, `sfx` → sfx, `text-outside` → free-text | waiting: Roboflow export (owner) |
| GitHub `xulihang/balloon-dataset` | webtoon | none shown | — | **dropped** (2026-11-02): the repo holds 8 pages and one ImageTrans project file, no usable labels; its models are not data |
| DCM772 (IAPR TC10) | old American | public-domain pages; masks' terms to check | balloon masks | to try (no account expected) |
| Comix v0.1 (Hugging Face `comix-v0_1-pages-tiny`) | old American | CC0 | ours (`comic_comix.py`, then `comic_autolabel.py comix`); their labels are machine-made | Task 3 |

No webtoon source is in yet: the one webtoon set in the design turned out to be manga; Kaggle and Hugging Face have none with bubble boxes (searched 2026-11-02). The two Roboflow webtoon sets above are the candidates.

## Round 4 (2026-11-18)

Downloaded with the owner's Roboflow, Kaggle and Hugging Face keys (no sign-in) into `incoming/comic4/` and imported
with `comic_import.py` into `data/comic3/<source>/` (both git-ignored), so `comic_split3.py` takes them as imported
sources (train and val by page). Owner, 2026-11-17: use all the data, kept private. Tall webtoon strips are cut into
page-shaped pieces between bubbles (`split_tall`); pieces with no text stay in as pages where the finder must find
nothing.

| Source | Style | Licence status | Labels → target | Status |
|---|---|---|---|---|
| Roboflow `crepidules-workspace/manga-bubble-detection` v1 | manga (English) | Public Domain (labels); publishers' art | `bubble` | **kept**: 602 pages, 3,538 bubbles; some pages are mirrored or upside down in the source itself |
| Roboflow `comic-speech-bubbles/comicbubbles` v1 | modern Western (Spider-Man) | CC BY 4.0; publishers' art | 9 bubble types → bubble, `information-bubble` → caption, `in-story-media-text` → free-text | **kept**: 87 pages; a few bubbles unlabelled |
| Roboflow `wip-sama-wip-sama-smastermega/webtoon-segmented` v5 | webtoon (English) | CC BY 4.0; publishers' art | `balloon-*` → bubble, `text-outside` → free-text, `sfx` | **kept**: 187 pages after removing Roboflow's brightness copies |
| Roboflow `manhwadev/manhua-bubbles-6fho3` v2 | manhwa (Korean) | MIT; publishers' art | speech/thinking → bubble, `system_box` → caption, `panel_text` → free-text, `sfx_sound` → sfx | **kept**: 6,524 pages and pieces; Roboflow's shear/hue copies are not all caught as repeats |
| Roboflow `saif-cxjs3/manhua-bubbles-1wbtl-jqnou` v1 | manhwa (Korean) | MIT; publishers' art | 8 bubble shapes → bubble, `system_bubble` → caption, standalone/background text → free-text, `sfx_sound` → sfx | **kept**: 3,072 pages and pieces |
| Roboflow `alexheh/webtoon-bubble-detection-osuqx-xqdqa` v1 | webtoon (Korean) | CC BY 4.0; publishers' art | dialog/thought/continuation → bubble, narration → caption, sound-effect → sfx, other text → free-text | **kept**: 198 whole episodes cut into 2,165 pieces |
| Roboflow `rf100-vl/speech-bubbles-detection-r22zt-ou0u6-jols` v1 | manga (English) | MIT; publishers' art | 6 bubble shapes → bubble | **kept**: 1,804 pages, 11,756 bubbles |
| Roboflow `ashu-biqfs/manga-segment_v2` v8 | manga (Portuguese, English) | MIT; publishers' art | balloons → bubble, `caption-box` → caption; word-level `text` left out | **kept**: 749 pages; rotated/sheared copies; some bubbles unlabelled (candidate for relabelling) |
| Hugging Face `PSImera/manga_bubbles_detect` | manga (Japanese raws, recent series) | CC BY-NC 4.0; publishers' art | `location-of-bubbles` → bubble | **kept**: 1,962 pages, 12,709 bubbles |
| Hugging Face `Hares08/webtoon_yolo26n_dataset` | webtoon | Apache 2.0; publishers' art | text lines → grown to bubbles | **dropped**: 7 of 4,000 sampled tiles kept (lines cut by tile edges don't grow to a closed bubble) |
| Kaggle `shinyunaa/ppocrv5-det-manhwa` | manhwa | MIT; publishers' art | text lines → grown to bubbles | **dropped**: 26 of 1,300 pages kept, for the same reason |
| Roboflow `moon-6f9b2/cg-manhua-bubbles-10k`, `testspace-r2sxk/webtoon-bbox-detection` | — | — | — | **gone** from Roboflow (404) |
| Roboflow `dataset-xd7q9/manga-speech-bubble-detection-hdgal`, `brawl-n5iqk/webtoon_bubble` | — | — | — | **not used**: no export; pages stretched to 640×640 |

Looked at on Kaggle and Hugging Face and not used: Manga109 and sets built on it (owner declined Manga109),
`MS92/MangaSegmentation` (gated), text-only or caption sets, Korean text without boxes, AMP-D.
