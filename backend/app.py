"""
FastAPI backend for AI Job Application Copilot.

POST /api/analyze        — accepts resume PDF + job description, returns full analysis.
POST /api/analyze/stream — same inputs, streams pipeline progress as Server-Sent Events.
GET  /api/health         — health check.
"""

import asyncio
import json
import logging
import traceback

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .pipeline import run_full_pipeline, run_full_pipeline_streaming, AnalysisResponse
from .resume_extractor import (
    extract_resume,
    extract_resume_streaming,
    ExtractedResume,
)
from .resume_tailor import tailor_resume_streaming

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worthyapply.api")

app = FastAPI(
    title="AI Job Application Copilot",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # The API is stateless — no cookies, sessions, or auth headers are used, and
    # the frontend never sends credentials. Pairing a wildcard origin with
    # allow_credentials=True would make Starlette echo back any requesting
    # origin and permit credentialed cross-site calls; keeping it False makes
    # the wildcard mean what it says without changing any current behavior.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_JD_LENGTH = 50_000


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
):
    # Validate file type
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    if resume.content_type and resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Validate file size
    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # Validate job description
    job_description = job_description.strip()
    if not job_description:
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    if len(job_description) > MAX_JD_LENGTH:
        raise HTTPException(status_code=400, detail="Job description is too long.")

    # Run the pipeline
    try:
        result = run_full_pipeline(contents, job_description)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        from .pipeline import _provider_error_message
        raise HTTPException(status_code=503, detail=_provider_error_message(e))

    return result


def _sse(data: dict) -> str:
    """Format a dict as a single Server-Sent Event frame."""
    return f"data: {json.dumps(data)}\n\n"


def _stream_pipeline(request: Request, gen, label: str) -> StreamingResponse:
    """
    Wrap a synchronous pipeline generator as an SSE StreamingResponse.

    Shared by /api/analyze/stream and /api/extract-resume/stream:
    - runs blocking generator steps in a worker thread,
    - detects client disconnect,
    - logs lifecycle events,
    - never leaks stack traces to the client.
    """

    async def event_generator():
        logger.info("stream started (%s)", label)
        yield _sse({"type": "stream_started"})

        # StopIteration cannot cross a thread boundary (asyncio.to_thread turns
        # it into a RuntimeError), so use a sentinel to detect the end.
        _DONE = object()

        def _next_event():
            try:
                return next(gen)
            except StopIteration:
                return _DONE

        try:
            while True:
                if await request.is_disconnected():
                    logger.info("client disconnected; aborting stream (%s)", label)
                    break

                event = await asyncio.to_thread(_next_event)
                if event is _DONE:
                    break

                etype = event.get("type")
                agent = event.get("agent")
                if etype in ("agent_started", "agent_completed", "agent_error"):
                    logger.info("[%s] event=%s agent=%s", label, etype, agent)
                elif etype == "pipeline_completed":
                    logger.info("[%s] pipeline completed", label)

                yield _sse(event)
        except asyncio.CancelledError:
            logger.info("stream cancelled (%s)", label)
            raise
        except Exception:
            logger.exception("unexpected error during streaming pipeline (%s)", label)
            yield _sse({
                "type": "agent_error",
                "agent": "pipeline",
                "message": "An unexpected error occurred. Please try again.",
            })
        finally:
            # Do NOT call gen.close(): on disconnect the generator may still be
            # running inside a worker thread, which would raise
            # "generator already executing". It holds no external resources.
            logger.info("stream closed (%s)", label)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/analyze/stream")
async def analyze_stream(
    request: Request,
    resume: UploadFile = File(...),
    job_description: str = Form(...),
):
    """
    Streaming variant of /api/analyze.

    Runs the identical three-agent pipeline (same prompts, schemas, order)
    but emits Server-Sent Events describing progress in real time. The final
    `pipeline_completed` event carries a payload identical in structure to the
    /api/analyze response (AnalysisResponse).

    The non-streaming /api/analyze endpoint is left unchanged for compatibility.
    """
    # ---- Same validation as /api/analyze ----
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    if resume.content_type and resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    job_description = job_description.strip()
    if not job_description:
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    if len(job_description) > MAX_JD_LENGTH:
        raise HTTPException(status_code=400, detail="Job description is too long.")

    gen = run_full_pipeline_streaming(contents, job_description)
    return _stream_pipeline(request, gen, label="analyze")


@app.post("/api/extract-resume", response_model=ExtractedResume)
async def extract_resume_endpoint(resume: UploadFile = File(...)):
    """Extract structured ResumeData from an uploaded resume PDF (V2 import flow)."""
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    if resume.content_type and resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        result = extract_resume(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Could not read your resume. Please try again or build from scratch.",
        )

    return result


@app.post("/api/extract-resume/stream")
async def extract_resume_stream(request: Request, resume: UploadFile = File(...)):
    """
    Streaming variant of /api/extract-resume.

    Runs the identical extraction (same prompt, schema, cleanup) but streams
    tokens as they are generated and emits a final `pipeline_completed` event
    whose `result` is identical in structure to the /api/extract-resume
    response (ExtractedResume). The non-streaming endpoint is left unchanged.
    """
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    if resume.content_type and resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    gen = extract_resume_streaming(contents)
    return _stream_pipeline(request, gen, label="extract-resume")


@app.post("/api/tailor-resume/stream")
async def tailor_resume_stream(
    request: Request,
    resume: UploadFile = File(...),
    job_description: str = Form(...),
    analysis: str = Form(...),
):
    """
    Resume Tailoring Agent (streaming).

    Applies the recommendations from the EXISTING JD analysis to the user's
    EXISTING structured resume, and streams the tailored resume + change list.

    Inputs (all already available in the app after analysis — the user does
    NOT re-upload or re-paste anything):
      - resume: the same PDF the user already uploaded
      - job_description: the same JD the user already submitted
      - analysis: JSON of the existing AnalysisResponse (JD Analysis output)

    The structured resume is obtained by reusing the existing extractor, so no
    new resume schema or parsing logic is introduced. The final
    `pipeline_completed.result` is {resume, changes}, where `resume` is in the
    existing Resume Builder schema and loads directly into the Resume Editor.
    """
    # ---- Validation (mirrors the other endpoints) ----
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    if resume.content_type and resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    job_description = job_description.strip()
    if not job_description:
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    if len(job_description) > MAX_JD_LENGTH:
        raise HTTPException(status_code=400, detail="Job description is too long.")

    try:
        analysis_obj = json.loads(analysis)
        if not isinstance(analysis_obj, dict):
            raise ValueError("analysis must be a JSON object")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid analysis payload.")

    # Extract the structured resume up front (reusing the existing extractor).
    # Done here (not in the stream) so extraction failures surface as a clean
    # HTTP error and the original resume is never touched.
    try:
        structured_resume = extract_resume(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Could not read your resume. Please try again.",
        )

    gen = tailor_resume_streaming(structured_resume, job_description, analysis_obj)
    return _stream_pipeline(request, gen, label="tailor-resume")
