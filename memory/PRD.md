# Smart Guided Demo — Biziverse (PRD)

## Original problem statement
Build "Smart Guided Demo" for Biziverse — a standalone AI-powered interactive sales demo.
Flow: Landing → 3-question Onboarding Quiz → Video Demo Player (YouTube) with intelligent overlays, animated cursors, "Try Yourself" iframe → End-of-Demo conversion modal.

Includes Admin Panel for managing videos, chapters, markers, Knowledge Base, quiz options, and unanswered AI questions.

Constraints:
- AI Assistant strictly answers from the KB or asks clarifying questions (no hallucination).
- LLM: GPT-5.2 via Emergent LLM key.
- Admin auth: Emergent-managed Google OAuth.
- Razorpay & OTP flows mocked for MVP.

## Architecture
```
/app/
├── backend/server.py         # FastAPI + MongoDB (videos, kb, chat, settings, unanswered)
└── frontend/src/
    ├── pages/                # Landing, Quiz, Demo + admin/*
    ├── contexts/AppContext.jsx
    └── lib/api.js, youtube.js
```

## Implemented
- Landing with toggleable Executive CTA
- 3-step Onboarding Quiz (business type / product cat / modules)
- Demo Player: YouTube IFrame, custom controls, marker overlays, cursors, narration, chapter timeline, auto-center active module, highlight active timestamps, Try Yourself iframe, End-of-Demo modal
- Admin Panel: Videos+chapters+markers editor, KB CRUD (with video_url/start/end), Quiz options, Unanswered questions, Settings, Coverage matrix, Analytics, Flows
- **AI Assistant powered by GPT-5.2 (2026-02)**:
  - Semantic KB matching (GPT-5.2 picks best entry from active KB list using question + tags + answer snippet)
  - Strict on single-word: triggers clarification instead of false match
  - Naturally rephrased answers grounded in KB answer text (no hallucination)
  - Clarification with up to 3 candidate-question buttons when ambiguous
  - Multilingual (EN/HI/GU/MR) — answers in user's language even if KB is in English
  - "Show Me" video CTA when matched KB entry has a video_url (with optional start/end)
  - Unanswered questions logged for admin review with executive CTA fallback

## Removed / Deprecated
- Mini-demos concept entirely removed. Videos now live directly on KB entries (`video_url`, `video_start`, `video_end`). The old `/admin/mini-demos*` and `/mini-demos/{id}` endpoints + `MiniDemosPage.jsx` are deleted.
- Naive Jaccard keyword matcher in `search_kb()` — replaced with GPT-5.2 semantic router.

## Pending / Backlog
- **P1** Wire `/admin/login` to Emergent Google Auth (currently bypassed)
- **P1** Run `testing_agent_v3_fork` end-to-end on public funnel + admin
- **P2** Refactor `Demo.jsx` (~780 lines) into `AIChatPanel`, `VideoPlayer`, `TryYourselfIframe`
- **P2** Replace mocked Razorpay & OTP with real integrations
- **P3** Backend pytest suite at `/app/backend/tests`

## Key endpoints
- `POST /api/ai/chat` — GPT-5.2 strict KB matcher + rephraser
- `POST /api/quiz/submit` — resolves demo videos for the session
- `GET /api/admin/kb`, `POST/PUT/DELETE /api/admin/kb` — KB CRUD with video fields
- `GET /api/admin/unanswered` — review log

## Models
- `kb_entries`: `{id, question, answers: {lang:text}, tags, video_url, video_start, video_end, active}`
- `module_videos`: `{id, module_key, title, video_url, markers, chapters, published, show_try_yourself, …}`
- `unanswered_questions`: `{id, session_id, question, language, business_type, …, resolved}`
- `user_sessions`: `{user_id, session_token, expires_at}` (Emergent Google Auth target)

## Notes for next agent
- `EMERGENT_LLM_KEY` is set in `/app/backend/.env`. Used only for GPT-5.2 calls in AI chat.
- Playwright/headless screenshot tool cannot render YouTube video frames — UI overlays render fine.
- KB entries can be toggled active/inactive via the admin UI; inactive ones are excluded from AI matching.
