# University of Raffel Luo assistant: design

Date: 2026-10-09. Status: approved in chat, awaiting written-spec review.

## Purpose

A basic retrieval-augmented (RAG) assistant for a fictional university, the University of Raffel Luo, used by two roles: students and staff. It is the system under test in the owner's research methodology study, which measures how well simple defences hold up and what they cost in usefulness. Findings are written up as audit entries on the Model Lab.

Version v0 is a typical basic build with no added safeguards, built the way many small teams build one. It is not deliberately broken; it is simply undefended, so that later improvements can be measured against a realistic baseline.

## Decisions

- **Data:** fictional university, fictional documents, fictional placeholder values. Designed so it could later answer from real documents.
- **Roles:** students see public documents; staff also see staff-only documents. No actions or tools in v0 (saved for v2).
- **v0 access rule:** prompt-only. All documents share one search index, and the system prompt states the user's role and that staff-only information is not for students. Proper retrieval-level access control is a planned later improvement.
- **Where it runs:** web-first, on the Model Lab, entirely in the visitor's browser via WebGPU. No server. Each visitor runs their own private copy with fictional data.
- **Engine and model:** WebLLM with Qwen2.5-1.5B-Instruct (q4f16_1), chosen by a spike on 2026-10-09:
  - Qwen2.5-1.5B answered all three test questions correctly, including "I don't know" for an off-topic one, in under 1 s per answer on the NVIDIA GPU after a one-time warm-up.
  - Llama-3.2-1B missed facts that were in the provided text.
  - Gemma-3-1B needed a configuration workaround in WebLLM 0.2.85 and then produced repetitive, incorrect answers.
- **Model is one setting**, so a different model can be compared later (for example a larger local model).
- **Browsers:** Chrome and Edge are the tested targets. Brave is Chromium-based and expected to work, but must be checked first because its privacy shields can limit graphics features.

## 1. The page on the Model Lab

- A chat window with a role switch ("Signed in as: Student / Staff"). It is not a real login.
- A clear notice: fictional university, fictional data, a research test system, runs only on your device.
- The model downloads once on first use (roughly 1 GB) with a progress bar, like the existing models.
- A "Save this conversation" button exports the chat as a file, for write-ups.
- It is a new kind of entry (an assistant under test), kept apart from the small-model archive and linked from its audit entry.

## 2. How v0 answers

1. Search all documents (public and staff-only) for passages relevant to the question, using a small embedding model that also runs in the browser. The search index is built from the document files at site build time.
2. Put the best passages into the prompt, together with the system instructions, which include the user's role and the prompt-only access rule.
3. The model writes the answer.

## 3. Content, kept separate from code

- **Documents:** one folder of short text files, each with a header giving its title and access level (`public` or `staff`).
  - About 12 public: admissions and fees, academic calendar, registration rules, exams and grading, library, IT help, campus facilities, student-services FAQ.
  - About 8 staff-only: HR and leave policy, exam-paper handling, marking and moderation, two internal memos, a staff directory, a student-records summary.
  - Written by the owner, using RSU's public pages only as a guide to the topics a university covers. Claude helps draft and review.
- **Placeholder values list:** the exact fictional values that appear only in staff-only documents, so the evaluation can check automatically whether any of them reaches a student session.
- **Test cases:** one file the owner builds up during testing. Each case records an ID, its OWASP Top 10 for LLM Applications category, the role it is sent as, the message(s), its pre-written success rule, and a development or held-out tag.
- **Normal questions:** about 50 ordinary student questions with known correct answers, to measure usefulness.

## 4. The evaluation runner

A script that opens the real Model Lab page in a browser on the NVIDIA GPU, replays the saved test cases and normal questions, and scores each answer against its rule. It records the results per version, so the same cases can be re-run after every change. Versions are named settings: v0 is the baseline, and each improvement (D1, D2, …) can be switched on in both the page and the runner.

## 5. Checking it works

- Retrieval: each normal question retrieves the right document.
- Answers: v0 answers the normal questions correctly (it is a working assistant, not a broken one).
- Roles: the role switch changes the prompt; the page sends nothing off the device.
- Page behaviour, like the rest of the site: loading and progress, a clear message when WebGPU is missing ("This assistant needs Chrome or Edge with graphics acceleration"), retry after a failed download, a clear message when GPU memory runs out, saving a conversation, accessibility, phone layout.
- Runner: a dry run on a few known cases gives the expected scores.

## 6. Demo checklist

- In Windows graphics settings, set the browser to High performance (NVIDIA). Without this, WebGPU may use the integrated AMD GPU, which was 10–30× slower in the spike.
- Load the model once before the demo, so it is cached.
- Show v0 and an improved version side by side.

## Out of scope for v0

Real login, actions or tool use, conversation memory across visits, and the larger-model comparison (later, local).

## Follow-ups

- Update the research proposal: the system under test becomes this university assistant (two roles, prompt-only v0, in-browser model), replacing the fictional online shop.
- Owner rules apply: no Claude attribution in commits; ask before pushing `master`; no invented numbers on the site.
