# Sound detective — design

Date: 2026-09-29. Status: approved in chat, awaiting written-spec review.

## Goal

Model No. 4 of the lab: **Sound detective**. A visitor records (up to 15 s) or uploads a clip; the model finds which of 17 everyday sounds happen **and when**, including sounds that overlap, and shows them as lanes on a timeline. A live listening mode shows sounds as they happen. Runs entirely in the browser, like the Sea creature detector. Honest report card; every number comes from a script.

## Sounds (v1, 17)

| Home | Street | Weather | People |
|---|---|---|---|
| dog bark, cat meow, doorbell, knocking, running tap, keyboard typing, glass breaking | siren, car horn, engine / traffic | rain, thunder | clapping, crying, laughing, footsteps, speech |

A sound stays only if it has enough clean clips (target ≥ 150 after licence filtering). Any sound dropped or merged is reported to the owner before training. Widening comes in later versions.

## 1. Data

- **Source:** FSD50K (Freesound, Zenodo). Map our 17 sounds to FSD50K / AudioSet-ontology labels; the mapping lives in one table in the selection script.
- **Licence:** keep only **CC0 and CC BY** clips (FSD50K metadata gives each clip's licence). Non-commercial clips are excluded. Every kept clip's author, Freesound link and licence go to `training/attribution/sounds-v1.csv`.
- **Top-up:** if a sound is short of clips, fetch more from Freesound with the owner's API key (key read from `training/.env`, never printed), same licence filter, and review a sample by ear before use.
- **"Nothing I know" negatives:** clips from other FSD50K classes, plus room tone and plain noise, labelled with no target sound. These teach the model to stay quiet instead of guessing.
- **Selection rules** (`training/sounds_select.py`, unit-tested like `openimages_select.py`): keep mapped clips with allowed licences; drop clips over 30 s; cap very common sounds (speech especially) so they don't drown the rest; keep FSD50K's own dev/eval split so test clips never leak into training (validation carved from dev).
- Data, audio and weights stay local and git-ignored.

## 2. Training

- **Base model:** EfficientAT MobileNet (pretrained on AudioSet, MIT licence), PyTorch, in the existing `modellab-train` conda env.
- **Multi-label:** one sigmoid score per sound, so several sounds can be "on" in the same slice (overlap).
- **Input:** 32 kHz mono, log-mel spectrogram with the parameters EfficientAT was pretrained with. Training on short crops that match the browser's slice length (≈1 s; exact window and step fixed by validation, then frozen).
- **Augmentation:** mixing two clips (teaches overlap), added background noise, gain changes.
- **Two sizes** (≈1M and ≈5M parameters). Pick by measured score against download size; the report card shows the trade-off.
- **Export:** ONNX (the model only; the spectrogram is computed in JS, see §3).

## 3. Measuring (never typed by hand)

- **Clip level:** on the frozen FSD50K eval clips: score per sound (average precision), a confusion table of the most common mix-ups.
- **Timeline accuracy:** FSD50K labels say *which* sounds, not *when*. So `training/sounds_synth.py` builds ~100 test clips by placing held-out eval sounds at known times over background, including overlaps. Measure event detection (found / missed / false) and timing error.
- **Examples script** (like `pick_examples.py`): picks ~5 sample clips (one with overlapping sounds) and the known-failure clips from the test data, records the ONNX model's real outputs, copies the audio to `static/samples/sounds/`, and writes `src/lib/data/sound-detective.json` (classes, threshold, data rows, metrics, samples, failures).
- **Python tests** for selection rules, event merging and evaluation maths.

## 4. The site

**Entry:** slug `sound-detective`, no. 4, `input: 'audio'`, new `task: 'events'`. Shown as `planned` until the model is measured, then `live`.

**Input:** the existing `AudioInput` (Record up to 15 s, Upload WAV/MP3/M4A, waveform). Uploads over 30 s: only the first 30 s is examined, with a note saying so. Clips under 0.5 s: "Too short to hear anything. Record a little longer."

**Runtime `src/lib/runtime/sound-detective.ts`** (same shape as `sea-detector.ts`):
1. Decode with Web Audio, mix to mono, resample to 32 kHz (`OfflineAudioContext`).
2. Log-mel spectrogram in JS (`src/lib/runtime/mel.ts`), matching Python's numbers.
3. ONNX Runtime scores each slice.
4. `src/lib/runtime/events.ts`: smooth scores, threshold per sound, merge neighbouring slices into events `{label, start, end, score}`.
- Same engine file as the detector (shipped once), same own-download with retry and combined progress bar. Nothing loads until a visitor records, uploads or picks a sample. The audio never leaves the device.

**Result display (`EventTimeline.svelte` + list):**
- Waveform on top, one lane per sound that was found (no empty lanes); overlapping sounds sit on separate lanes; a time axis.
- Headline counts events like the detector: "3 dog barks, speech, 1 knock"; nothing found → "No sounds it knows" and the list of what it listens for.
- Event list: sound, time range, confidence; activating one plays that stretch.
- Phones: full-width lanes with labels above them; no sideways scroll. Colour is never the only cue (lanes are labelled). Keyboard and screen-reader usable.

**Samples** carry Freesound credit + licence links (existing `Sample.credit*` fields).

**Live listening** (a third button, "◉ Listen live", next to Record and Upload):
- The mic stream is read in small chunks (AudioWorklet), resampled to 32 kHz; every ≈0.5 s the latest slice goes through the same mel → model → event-merging code as clips. No separate model, no separate numbers.
- The timeline scrolls, showing the last ≈30 s; lanes appear as sounds are heard; a large "now hearing" label shows the current sound(s), or "Listening…" when nothing clears the threshold.
- Privacy and battery: nothing is saved or uploaded; audio is scored and discarded except the last 30 s held in memory for the result. A visible red "Listening" indicator; the button becomes "■ Stop". Auto-stops after 2 minutes, when the tab is hidden, or when leaving the page. Stopping turns the last ≤30 s into a normal result (lanes, list, tap to replay).
- Slow devices: if scoring can't keep up with real time, slices are skipped rather than queued, and a note says "Your device is busy, some moments were skipped".
- Errors: mic denied / unsupported reuse the existing messages; the model download happens before listening starts (progress bar), so the first seconds aren't lost.
- Report card note: live mode scores ≈0.5 s steps, so very short sounds are missed more often than in clips; measured on the synthetic clips by streaming them through the live path, if the numbers differ.

## 5. Tests

- **Unit (Vitest):** mel matches Python reference values on a fixed clip; event merging (gaps, overlaps, events at the very start/end, a single slice, all silence); headline wording and plurals.
- **E2E (Playwright, Chromium + WebKit):** live mode (Chromium only, since WebKit has no fake microphone) with a fake microphone playing a known clip (expected sounds appear while listening; auto-stop after 2 min using a shortened test limit; stops when the tab is hidden; mic denied message; stopping gives a normal result); every sample gives the recorded events (same labels, times within ±0.25 s, scores within 0.03); overlap shows on separate lanes; a silent clip says "No sounds it knows"; stereo 44.1 kHz MP3 and a >30 s upload work; too-short clip message; failed model/engine download recovers; home page never downloads the model; axe after a result in Light and Dark.
- **Python:** selection rules, synthetic-clip builder, evaluation maths.

## 6. Report card

- **Data:** sources and licences, clip counts, split, base model and size.
- **Metrics:** score per sound; timeline accuracy (from the synthetic test); small vs medium model accuracy and download.
- **How it fails:** real clips it got wrong, with the reason.
- **Known gaps:** only 17 sounds; phone mics differ from training audio; quiet sounds under speech get missed (confirmed or corrected by measurement).

## Out of scope (later versions)

More sounds, the speech translator.

## Owner rules that apply

No Claude attribution in commits; ask before pushing `master`; never print or commit API keys; no invented numbers.
