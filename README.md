# WorthyApply

**Make every application worth submitting.**

[Live Demo](https://worthyapply-sigma.vercel.app/) · [Backend API](https://worthyapply.onrender.com/api/health)

---

## What is WorthyApply?

WorthyApply is an AI-powered application intelligence platform that helps job seekers understand their fit for a role and optimize their resume — before they hit submit.

Upload your resume. Paste a job description. In seconds, get:

- A structured breakdown of what the role requires
- A realistic match score based on evidence in your resume
- A clear view of your matching skills vs. skill gaps
- Specific, truthful resume bullet improvements you can copy and use

---

## How It Works

```
Resume (PDF)  +  Job Description
              │
              ▼
┌──────────────────────────────┐
│     Agent 1: Job Analyzer    │  → Structured role requirements
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│    Agent 2: Match Analyzer   │  → Score, recommendation, skill gaps
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│   Agent 3: Resume Optimizer  │  → Truthful bullet improvements
└──────────────────────────────┘
               │
               ▼
      Application Intelligence
```

Three specialized AI agents run in sequence. Each produces structured output using Pydantic schemas. No hallucinated experience. No invented metrics. Every suggestion is grounded in your actual resume content.

---

## Features

| Feature | Description |
|---------|-------------|
| **Job Analysis** | Extracts title, skills, responsibilities, keywords from any JD |
| **Match Scoring** | Realistic 0–100 score with Apply / Maybe / Do Not Apply verdict |
| **Skill Constellation** | Interactive visualization of matched vs. missing skills |
| **Resume Optimization** | Before/After/Why bullet transformations with copy-to-clipboard |
| **Application Brief** | One-click copyable summary of your fit for the role |
| **Progressive Disclosure** | See the big picture first, drill into details on demand |

---

## Tech Stack

### Backend
- Python · FastAPI · Uvicorn
- LangChain · LangChain-Groq
- Groq (`openai/gpt-oss-120b`)
- Pydantic (structured AI output)
- PyPDF (resume text extraction)

### Frontend
- Next.js 16 · React 19 · TypeScript
- Tailwind CSS v4
- Framer Motion
- Custom SVG skill constellation

### Infrastructure
- Backend: [Render](https://render.com)
- Frontend: [Vercel](https://vercel.com)

---

## Project Structure

```
WorthyApply/
├── main.py                        # AI pipeline (source of truth)
├── requirements.txt               # Python dependencies
├── backend/
│   ├── app.py                     # FastAPI server
│   ├── pipeline.py                # Web-callable integration layer
│   └── requirements.txt           # Backend-specific deps
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # Main entry (state machine)
│   │   ├── layout.tsx             # Root layout + fonts
│   │   └── globals.css            # Design system
│   ├── components/
│   │   ├── Landing.tsx            # Product landing page
│   │   ├── Workspace.tsx          # Upload + JD input
│   │   ├── Processing.tsx         # Analysis loading state
│   │   ├── Results.tsx            # Scroll-driven results
│   │   └── results/
│   │       ├── OverviewHero.tsx   # Score + recommendation
│   │       ├── SkillConstellation.tsx
│   │       ├── RequirementsBlock.tsx
│   │       ├── MatchBlock.tsx
│   │       ├── ImprovementsBlock.tsx
│   │       ├── DetailsBlock.tsx
│   │       ├── ApplicationBrief.tsx
│   │       ├── CopyButton.tsx
│   │       └── Reveal.tsx
│   └── lib/
│       ├── api.ts                 # API client
│       └── types.ts               # TypeScript interfaces
├── .env.example
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Groq API key](https://console.groq.com)

### Setup

```bash
# Clone
git clone https://github.com/sanath-2512/Worthyapply.git
cd Worthyapply

# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Environment
cp .env.example .env
# Add your GROQ_API_KEY to .env

# Frontend
cd frontend
npm install
```

### Run Locally

```bash
# Terminal 1 — Backend
source .venv/bin/activate
uvicorn backend.app:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API

### `GET /api/health`

Returns `{"status": "ok"}`.

### `POST /api/analyze`

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `resume` | File (PDF) | The candidate's resume |
| `job_description` | String | Full job description text |

**Response:** JSON containing `job_analysis`, `match_analysis`, `resume_optimization`.

---

## Three-Agent Architecture

| Agent | Input | Output | Purpose |
|-------|-------|--------|---------|
| Job Analyzer | Job description | `JobAnalysis` | Structure the role's requirements |
| Match Analyzer | JobAnalysis + Resume | `MatchAnalysis` | Score fit, identify gaps |
| Resume Optimizer | All above + Resume | `ResumeOptimization` | Suggest truthful improvements |

### Grounding Rules

The optimizer **never**:
- Invents experience, skills, or metrics
- Changes "contributed" to "led" without evidence
- Adds technologies just because they appear in the JD
- Claims outcomes not supported by the resume

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `GROQ_API_KEY` | Backend (Render) | Groq API authentication |
| `NEXT_PUBLIC_API_URL` | Frontend (Vercel) | Backend URL for API calls |

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Backend | Render (Free) | https://worthyapply.onrender.com |
| Frontend | Vercel (Free) | https://worthyapply-sigma.vercel.app |

> Free Render instances sleep after 15 min of inactivity. First request may take ~30s to cold-start.

---

## License

MIT

---

Built by [Sanath](https://github.com/sanath-2512)
