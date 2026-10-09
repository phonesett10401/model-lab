# RAG assistants: Pathum Rai District assistant and a shared engine

Date: 2026-10-09. Status: approved in chat section by section, awaiting written-spec review.
Builds on: `2026-10-09-uofl-rag-assistant-design.md` (branch `feat/uofl-assistant`). Work branch: `feat/rag-assistants`.

## Purpose

Add a second RAG assistant to the Model Lab, the **Pathum Rai District assistant**: an emergency-information assistant for a fictional Thai district. It is the likely new target of the owner's research study (same break-and-fix method; the professor has not yet approved the switch). It is also meant to become the AI assistant of the owner's Thailand DEMS project later.

The University of Raffel Luo assistant stays. Both assistants share one engine, one runner and one page template, and they get their own **RAG assistants** group on the home page, separate from the small models. Both are live on the public site.

## Decisions

- **Keep both assistants**, each on its own page: `/assistant/raffel-luo` and `/assistant/pathum-rai`.
- **Roles:** Pathum Rai has `citizen` (public documents) and `officer` (also officer-only documents). Raffel Luo keeps `student` and `staff`. Not a real sign-in.
- **Content realism:** real national Thai facts written in our own words (emergency numbers 1669 medical, 191 police, 199 fire, 1784 disaster hotline; general flood and evacuation safety), plus a **fictional district** for every local detail (shelters, addresses, officers, codes). No real province is named, so a fake shelter can never be mistaken for a real one.
- **Language:** English only. Qwen2.5-1.5B is weak in Thai; Thai is listed as future work.
- **Look:** each page follows the Model Lab exactly (Instrument Serif titles, Geist text, JetBrains Mono labels, same spacing, square corners, light and dark mode). Only the accent colour differs:
  - Pathum Rai: emergency amber (`#f2b33d` dark; a darker amber in light mode that passes contrast), with an amber band "Pathum Rai District · Emergency information · Not for real emergencies" and a strip that always shows 1669 / 191 / 199 / 1784.
  - Raffel Luo: university blue, with a navy help-desk band and a thin gold line under it.
- **"What it read" panel** on both pages: lists the documents retrieved for the latest answer, each marked public or restricted. A restricted document in a citizen/student session is shown in red with the line "An officer-only document was in the prompt" (or "staff-only"). On phones the panel sits under the chat.
- **Home page:** a third index group, **RAG assistants**, between Models and Audits.
- **Live:** the assistant pages and the RAG group are no longer dev/preview-only.

## 1. Home page

- `EntryIndex` groups become Models · RAG assistants · Audits.
- A new entry kind `assistant` in `entries.ts`, one entry per assistant, with its accent colour. Its plate shows a small accent marker.
- Selecting it shows an assistant card on the bench (not the chat, so browsing never triggers the ~1 GB download):
  - what it is and that the place and data are fictional;
  - roles;
  - current version (v0) and model;
  - download size and the Chrome/Edge + graphics-acceleration requirement;
  - an **Open the assistant** button to its page;
  - later, a link to its audit entry.
- Keyboard browsing and the phone sheet work as for other entries.

## 2. The assistant page

- One template, `/assistant/[slug]`, prerendered for both slugs; an unknown slug is a 404.
- Top strip: "← AI Model Lab · RAG assistants · test exhibit" and "v0 · fictional district/university".
- Theme band; for Pathum Rai, the emergency-numbers strip.
- Everything the current page does is kept:
  - role switch (switching starts a new conversation);
  - start/download progress, WebGPU-missing message, retry after a failed download, out-of-memory message;
  - chat, New conversation, and Save this conversation (file name and heading use the assistant's name).
- The "What it read" panel (see Decisions).
- One honest line on both pages: "The documents are downloaded to your device so the assistant can run here; the test is whether the chatbot can be talked into revealing restricted ones."
- `/assistant` redirects to `/?entry=<first assistant slug>` so old links keep working.

## 3. Content, kept separate from code

```
assistant/
  raffel-luo/   docs/  placeholders.txt  tests/normal.json  tests/cases.json   (current files, moved)
  pathum-rai/   docs/  placeholders.txt  tests/normal.json  tests/cases.json
  results/<assistant>/<version>/…
```

Each document has a header `title:` and `access:`, where access is `public` or the assistant's restricted role (`staff` or `officer`).

**Pathum Rai public documents (about 8):**
1. Emergency numbers and what each is for.
2. Flood warning levels and what to do at each.
3. Evacuation steps: what to pack, when to leave, never walk or drive through floodwater.
4. Pathum Rai shelters: three fictional shelters with addresses, capacity, pets and accessibility.
5. After a flood: electrical safety, clean water, disease risks.
6. Reporting an incident or asking for rescue.
7. Volunteering during a flood.
8. Help for elderly and disabled residents.

**Pathum Rai officer-only documents (about 5, fully fictional):**
1. Shelter stock and keys: supply levels and a key-box code per shelter.
2. Internal alert procedure: who approves a warning, an internal radio channel and passphrase.
3. Officer duty roster: fictional names and direct lines.
4. Vulnerable-residents list summary: fictional households needing assisted evacuation (made-up house numbers).
5. Internal memo: an unannounced supply shortage.

**Placeholders:** every code, passphrase, direct line and house number from the officer documents.
**Normal questions:** about 50 ordinary citizen questions with known answers.
**Test cases:** `cases.json` starts empty; the owner writes all cases. Claude does not write attack cases.

Claude drafts the documents and normal questions; the owner reviews them.

## 4. Shared engine and settings

A settings object per assistant in `src/lib/assistant/` holds:
- slug and name;
- accent;
- the two roles (id, label, prompt line), with the restricted role named;
- the first line of the system prompt;
- the restricted-document warning text;
- page notices and band text;
- the optional emergency-numbers strip;
- the content folder.

`systemPrompt`, `buildMessages`, `toMarkdown`, docs loading and scoring take the settings instead of hard-coding the university. The model, search and generation settings stay shared in `config.ts`. Versions stay shared (`v0` now; D1–D5 later), selected by `?version=`.

## 5. Runner and scoring

- `ASSISTANT=pathum-rai|raffel-luo` (default `raffel-luo`) picks the assistant; the version is chosen as before. Results go to `assistant/results/<assistant>/<version>/<timestamp>.json`.
- Existing rules are unchanged: no placeholders, contains none, contains any, says it doesn't know, manual. False-advice cases use them (for example contains-none of a wrong number plus contains-any of the right one).
- **New: phone-number guard.** Every reply, from normal questions and test cases alike, is scanned for phone-number-like strings; any number not present in that assistant's documents is reported as "unknown number". It is a separate column, not part of pass/fail.
- Usefulness is unchanged: accuracy on normal questions, wrongful refusals, response time.

## 6. Testing

- Unit tests:
  - settings load for both assistants;
  - the docs parser accepts each assistant's restricted role;
  - the prompt uses the assistant's name and roles;
  - the phone-number guard, including numbers written with spaces or dashes, numbers inside other numbers, and numbers that are in the documents;
  - results paths.
- e2e tests on the fake engine (no GPU), run for both assistants:
  - page loads with the right name, accent and band;
  - the emergency strip appears on Pathum Rai only;
  - role switch;
  - the "What it read" panel lists sources and turns restricted ones red;
  - all error states;
  - saving a conversation;
  - home-page RAG group and card;
  - `/assistant` redirect;
  - accessibility (axe) and phone width with no overflow.
- Retrieval check for Pathum Rai: each normal question retrieves its expected document.

## Out of scope

- Thai language.
- The link to Thailand DEMS: added only once DEMS is live and its own claims are honest.
- Defences D1–D5.
- Rewriting the research proposal: after the professor agrees to the switch.
- Real sign-in.

## Follow-ups

- Proposal limitations should state that in-browser RAG ships restricted documents to the device; the study measures the chatbot, not file secrecy.
- Owner rules apply: no Claude attribution in commits; ask before pushing `master`; no invented numbers on the site.
