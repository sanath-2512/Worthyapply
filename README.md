# WorthyApply

**Make every application worth submitting.**

A portfolio-quality web application that analyzes job descriptions, evaluates resume fit, and provides truthful resume optimization suggestions — powered by a three-agent LangChain pipeline running on Groq.

## Problem Statement

Job seekers spend hours tailoring resumes for each application without knowing if they're a good fit. This tool automates the analysis: upload your resume, paste a job description, and instantly understand your match score, skill gaps, and exactly which resume bullets to improve.

## Features

- **Job Analysis** — Structured extraction of title, skills, responsibilities, keywords
- **Match Analysis** — Realistic match scoring with skill gap identification
- **Resume Optimization** — Truthful bullet improvements with copy-to-clipboard
- **PDF Resume Upload** — Drag-and-drop with validation
- **Premium Dark UI** — Smooth scrolling, Framer Motion animations, responsive design
- **Scroll-Aware Navigation** — Sticky section nav with active indicators

## Architecture

```
┌─────────────────────┐
│   Next.js Frontend  │
│   (React/TypeScript │
│    Tailwind/Framer) │
└──────────┬──────────┘
           │ HTTP POST /api/analyze
           ▼
┌─────────────────────┐
│   FastAPI Backend   │
│   (backend/app.py)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pipeline Layer     │
│  (backend/pipeline) │
│                     │
│  ┌───────────────┐  │
│  │ Agent 1:      │  │
│  │ Job Analyzer  │  │
│  └───────┬───────┘  │
│          ▼          │
│  ┌───────────────┐  │
│  │ Agent 2:      │  │
│  │ Match Analyzer│  │
│  └───────┬───────┘  │
│          ▼          │
│  ┌───────────────┐  │
│  │ Agent 3:      │  │
│  │ Resume Optim. │  │
│  └───────────────┘  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     Groq API        │
│ (openai/gpt-oss-120b)│
└─────────────────────┘
```

## Three-Agent Architecture

| Agent | Input | Output | Purpose |
|-------|-------|--------|---------|
| Job Analyzer | Job description text | `JobAnalysis` | Extract structured job info |
| Match Analyzer | `JobAnalysis` + resume text | `MatchAnalysis` | Score candidate fit |
| Resume Optimizer | `JobAnalysis` + `MatchAnalysis` + resume | `ResumeOptimization` | Suggest truthful improvements |

All agents use structured Pydantic output via `create_agent` with `response_format`.

## Tech Stack

**Backend:**
- Python 3.14
- FastAPI + Uvicorn
- LangChain + LangChain-Groq
- Pydantic (structured AI output)
- PyPDF (resume text extraction)
- Groq (openai/gpt-oss-120b)

**Frontend:**
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Framer Motion

## Project Structure

```
Job_application-copilot/
├── main.py                  # Original CLI pipeline (source of truth)
├── backend/
│   ├── __init__.py
│   ├── app.py               # FastAPI server
│   ├── pipeline.py          # Web-callable integration layer
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── LandingPage.tsx
│   │   ├── LoadingState.tsx
│   │   ├── ResultsPage.tsx
│   │   └── results/
│   │       ├── ResultHero.tsx
│   │       ├── JobAnalysisSection.tsx
│   │       ├── MatchAnalysisSection.tsx
│   │       ├── ResumeOptimizationSection.tsx
│   │       ├── SectionReveal.tsx
│   │       └── CopyButton.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── types.ts
│   └── .env.local
├── .env                     # GROQ_API_KEY (not committed)
├── .env.example
├── .gitignore
└── README.md
```

## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- Groq API key (get one at https://console.groq.com)

### Environment Variables

```bash
cp .env.example .env
# Edit .env and add your Groq API key
```

### Backend Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

## How to Run

### Start the Backend

```bash
source .venv/bin/activate
uvicorn backend.app:app --reload --port 8000
```

### Start the Frontend

```bash
cd frontend
npm run dev
```

Then open http://localhost:3000

## How the AI Pipeline Works

1. User uploads a PDF resume and pastes a job description
2. FastAPI extracts text from the PDF using PyPDF
3. **Agent 1** analyzes the job description into structured fields
4. **Agent 2** compares the resume against the job analysis, producing a match score and recommendation
5. **Agent 3** suggests specific, truthful resume improvements grounded in actual resume content
6. All structured results are returned as JSON to the frontend
7. Frontend renders the analysis with animations and scroll-aware navigation

## API Overview

### `GET /api/health`

Returns `{"status": "ok"}`.

### `POST /api/analyze`

**Request:** `multipart/form-data`
- `resume` — PDF file
- `job_description` — string

**Response:** JSON with `job_analysis`, `match_analysis`, `resume_optimization`

## Screenshots

*Add screenshots after running the application.*

## Known Limitations

- No real-time progress from individual agents (loading state is animated but not step-accurate)
- Scanned/image PDFs cannot be processed (text extraction only)
- Groq rate limits may cause occasional 429 errors
- No persistent storage — results exist only in browser memory
- Single analysis at a time (no queue)
