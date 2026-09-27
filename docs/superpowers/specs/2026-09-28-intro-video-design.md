# AI Model Lab — intro video and /intro page design

Date: 2026-09-28
Status: draft for review

## 1. Purpose

A 15-second motion-graphics video with sound, plus an `/intro` page that plays it and continues into a short scroll story about what the lab is, ending in a link into the lab (`/`).

**Uses:**
- A shareable intro link for the owner's professor, recruiters and LinkedIn.
- Square and vertical cuts of the same video for LinkedIn and social posts.

**Success:**
- The owner watches the video with sound on phone and laptop and likes it.
- A visitor understands what the lab is (small single-purpose models with honest report cards) before entering it.
- The lab at `/` stays exactly as fast as today.

## 2. Scope

**In scope**
- A Remotion project in `video/` with one composition, `Intro` (15 s, 30 fps, 450 frames), rendered in three layouts: `wide` 1920×1080, `square` 1080×1080, `tall` 1080×1920.
- Code-generated sound design, mixed into the render.
- Poster stills per layout.
- An `/intro` route in the site: title screen, video, scroll story, ending link.
- A "▶ Watch the intro" link in the lab's top bar.

**Out of scope**
- Licensed music, voiceover and captions (the video has no speech; the scroll story is its text alternative).
- Changing the lab at `/` beyond the top-bar link.
- Audits or any red-team content in the video or on `/intro`.

## 3. Video storyboard (15 s)

| # | Time | Picture | Sound |
|---|---|---|---|
| 1 | 0.0–1.5 s | "AI MODEL LAB" types in (mono, red), then *"Explore the lab."* (serif italic) | ambient pad swells; key ticks per letter |
| 2 | 1.5–4.5 s | Rows of specimen plates stream past, accelerating: the three real models plus blank plates reading "In training…" / "Coming soon" (no invented model names) | a whoosh per row, pitch rising |
| 3 | 4.5–5.5 s | Motion brakes on "No. 01 · Creature categorizer"; the plate swells to fill the frame | whoosh brake + "clunk" |
| 4 | 5.5–8.5 s | Octopus photo drops in, the red scan line sweeps, bars spring to octopus 94% / squid 4% / cuttlefish 2% | scan hum; rising ticks; "ding" on the answer |
| 5 | 8.5–11.0 s | Cuttlefish photo; "true: cuttlefish", "said: squid 71%"; a large red **WRONG** stamp slams down | ambience drops out for a beat; heavy stamp thud |
| 6 | 11.0–13.5 s | Frame folds into a report card: Data, Accuracy ("—"), How it fails ("cuttlefish → squid") + "RECORDED" stamp | three paper taps |
| 7 | 13.5–15.0 s | "Click it. Test it. *See the result.*" then "AI MODEL LAB" | warm resolving chord, fade out |

- Every number and prediction in beats 4–6 carries a visible **SAMPLE** stamp.
- **Look:** the lab's dark theme tokens (`#141213` ground, `#f3eeee` ink, `#ff4f4f` red, `#1d1a1b` plates), Instrument Serif, Geist and JetBrains Mono.
- **Assets:** `octopus.jpg` and `cuttlefish.jpg` (supplied by the owner; the owner confirms usage rights).
- **Layouts:** the same beats and timing in every layout; only the composition re-flows (for example, in tall, the photo sits above the bars instead of beside them).

## 4. Sound

- A Node script (`video/scripts/make-sounds.mjs`) synthesises every cue as WAV into `video/public/sfx/`: pad, tick, whoosh, brake, clunk, scan, ding, thud, paper, chord.
- Each cue is placed with a Remotion `<Sequence>` at its beat's frame. Levels are balanced so the pad sits under the effects; peak levels stay below clipping.
- The rendered MP4 carries an AAC stereo track.

## 5. Rendering and outputs

- `pnpm --dir video render` renders all three layouts plus posters.
- **Site copies** (committed): `static/intro/intro-wide.mp4`, `static/intro/intro-tall.mp4`, `static/intro/poster-wide.jpg`, `static/intro/poster-tall.jpg`.
- **Social copies** (not deployed): `video/out/intro-square.mp4`, `video/out/intro-tall.mp4`.
- **Size targets:** wide ≤ 3 MB, tall ≤ 2 MB (H.264, CRF tuned); square has no limit.
- The `video/` folder has its own `package.json` and is not part of the site build.

## 6. /intro page

Prerendered like the rest of the site. Four stages:

**A. Title screen**
- Full viewport, dark, with the octopus faintly behind.
- "AI MODEL LAB", *"Explore the lab."*, a primary **▶ Enter the lab** button, and "🔊 Best with sound · 15 seconds".
- A "Skip intro →" link (top right) jumps to stage C.
- Tapping Enter is the user gesture that unlocks audio: the video (preloaded) plays **unmuted** immediately.

**B. Video**
- Portrait phones (`(orientation: portrait) and (max-width: 639px)`) get the tall file; everything else gets wide.
- Controls: mute/unmute, replay, skip. A thin red progress bar.
- If `play()` is rejected, the native controls are shown so the visitor can start it manually. The page never freezes.

**C. Scroll story, "What the lab is"**
- A visual stays pinned while four statements scroll past. The active statement is tracked with IntersectionObserver; the inactive ones dim.
- On desktop the visual is on the left and the text on the right; on phones the visual is pinned at the top with the text underneath.

| Step | Statement | Visual state |
|---|---|---|
| 1 | **One job each.** Small models, each trained for one task. | plates slide onto an archive shelf that extends past the edge |
| 2 | **Made by hand.** Collect and label in Roboflow → train → test on photos it has never seen. | one photo travels Collect → Train (accuracy line climbs) → Test (scan line) |
| 3 | **Honest report cards.** Accuracy per category, and the cases where it's wrong. No number until it's measured. | a report card builds column by column; the "HOW IT FAILS" stamp lands |
| 4 | **Runs on your device.** Your photo never leaves it. | a phone outline; the model moves into it; a lock appears |

- When the video ends, the page smoothly scrolls to stage C, unless the visitor scrolled during the video or prefers reduced motion.

**D. Ending**
- "New specimens are added as they're trained." and a primary **Open the lab →** link to `/`.

**Lab top bar**
- A small "▶ Watch the intro" link to `/intro`.

**Reduced motion**
- No auto-scroll; the story visuals show their finished states; the title screen also offers "Read instead" (equivalent to Skip). The video itself still plays when chosen.

**Meta**
- Own title ("Intro · AI Model Lab"), description, and a link-preview image (the wide poster).

## 7. Quality checks

| Check | What | Tool |
|---|---|---|
| Video review | Stills of all 7 beats in all 3 layouts, shown to the owner before the final render | Remotion stills |
| Video integrity | Each file is 15.0 s ±0.1, has an audio stream, and meets its size target | ffprobe (bundled with Remotion) |
| Flows | Title screen shows; Enter starts playback with `muted === false`; Skip reaches the story; steps become active on scroll; "Open the lab →" goes to `/`; the phone viewport gets the tall source; reduced motion means no auto-scroll | Playwright |
| Lab link | The lab's top bar links to `/intro` | Playwright |
| Accessibility | axe scan on `/intro`, both themes; keyboard can reach Enter, Skip, the controls and Open the lab | axe + Playwright |
| Every size | `/intro` at 320–2560 px with no horizontal overflow | Playwright size sweep |
| Lab speed | Lighthouse on `/` is unchanged (performance ≥ 95); `/` does not request any video | Lighthouse + Playwright |

## 8. Open items

- The owner confirms usage rights for the octopus and cuttlefish photos before the site goes public.
- The square and tall social copies are delivered as files; posting them is up to the owner.
