import { AnalysisResponse } from "./types";
import { ResumeData } from "./resume-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Streaming event contract (mirrors backend/pipeline.py event envelope) ──

export type AgentId =
  | "resume_analyzer"
  | "job_analyzer"
  | "matcher"
  | "resume_optimizer"
  | "resume_importer"
  | "resume_tailor"
  | "pipeline";

export interface ResumeChange {
  section: string;
  description: string;
}

export interface RecommendationResult {
  id: number;
  recommendation: string;
  status: "implemented" | "not_implemented";
  section?: string;
  change?: string;
  reason?: string;
}

export interface TailoredResumeResult {
  resume: Partial<ResumeData>;
  changes: ResumeChange[];
  recommendations?: RecommendationResult[];
}

export type PipelineEvent =
  | { type: "stream_started" }
  | { type: "agent_started"; agent: AgentId }
  | { type: "agent_progress"; agent: AgentId; message: string }
  | { type: "agent_token"; agent: AgentId; text: string }
  | { type: "agent_token_reset"; agent: AgentId }
  | { type: "agent_output"; agent: AgentId; data: Record<string, unknown> }
  | { type: "agent_completed"; agent: AgentId }
  | { type: "agent_error"; agent: AgentId; message: string }
  | { type: "pipeline_completed"; result: unknown };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export async function analyzeApplication(
  resumeFile: File,
  jobDescription: string
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("job_description", jobDescription);

  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new ApiError(
      "Could not connect to the server. Please check that the backend is running.",
      0
    );
  }

  if (!response.ok) {
    let detail = "An unexpected error occurred. Please try again.";
    try {
      const body = await response.json();
      if (body.detail) {
        detail = body.detail;
      }
    } catch {
      // ignore parse error
    }
    throw new ApiError(detail, response.status);
  }

  return response.json();
}

/** V2: Extract structured ResumeData from an uploaded resume PDF. */
export async function extractResume(resumeFile: File): Promise<Partial<ResumeData>> {
  const formData = new FormData();
  formData.append("resume", resumeFile);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/extract-resume`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new ApiError(
      "Could not connect to the server. Please check that the backend is running.",
      0
    );
  }

  if (!response.ok) {
    let detail = "Could not read your resume. Please try again.";
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {}
    throw new ApiError(detail, response.status);
  }

  return response.json();
}


/**
 * Shared SSE consumer. POSTs `formData` to `path`, invokes `onEvent` for
 * every structured event as it arrives (including live `agent_token`
 * deltas), and resolves with the final `pipeline_completed` result.
 *
 * Uses a fetch ReadableStream (not EventSource) because the request is a
 * multipart POST, which EventSource cannot send. Tolerates malformed
 * frames, supports AbortSignal cancellation, and surfaces `agent_error`
 * events as ApiError.
 */
async function consumeSSE<T>(
  path: string,
  formData: FormData,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      body: formData,
      signal,
    });
  } catch {
    if (signal?.aborted) throw new ApiError("Cancelled.", 0);
    throw new ApiError(
      "Could not connect to the server. Please check that the backend is running.",
      0
    );
  }

  if (!response.ok) {
    // Validation errors (4xx) come back as normal JSON, not a stream.
    let detail = "An unexpected error occurred. Please try again.";
    try {
      const body = await response.json();
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      // ignore parse error
    }
    throw new ApiError(detail, response.status);
  }

  if (!response.body) {
    throw new ApiError("The server returned an empty response.", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: T | null = null;
  let gotResult = false;

  const dispatch = (raw: string) => {
    // An SSE frame may contain multiple `data:` lines; concatenate them.
    const dataLines = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart());
    if (dataLines.length === 0) return;

    let event: PipelineEvent;
    try {
      event = JSON.parse(dataLines.join("\n")) as PipelineEvent;
    } catch {
      // Malformed frame — skip it rather than crashing the whole stream.
      return;
    }

    onEvent(event);

    if (event.type === "agent_error") {
      throw new ApiError(event.message || "Processing failed.", 500);
    }
    if (event.type === "pipeline_completed") {
      finalResult = event.result as T;
      gotResult = true;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (frame.trim()) dispatch(frame);
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (signal?.aborted) throw new ApiError("Cancelled.", 0);
    throw new ApiError("The connection was interrupted. Please try again.", 0);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  if (!gotResult || finalResult === null) {
    throw new ApiError("The stream ended before completing. Please try again.", 0);
  }
  return finalResult;
}

/**
 * Streaming variant of analyzeApplication. Streams live agent lifecycle
 * events and token deltas, resolving with the final AnalysisResponse.
 */
export async function analyzeApplicationStream(
  resumeFile: File,
  jobDescription: string,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("job_description", jobDescription);
  return consumeSSE<AnalysisResponse>("/api/analyze/stream", formData, onEvent, signal);
}

/**
 * Streaming variant of extractResume. Streams live token deltas as the
 * resume is parsed, resolving with the final structured ResumeData.
 */
export async function extractResumeStream(
  resumeFile: File,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<Partial<ResumeData>> {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  return consumeSSE<Partial<ResumeData>>(
    "/api/extract-resume/stream",
    formData,
    onEvent,
    signal
  );
}

/**
 * Resume Tailoring Agent (streaming). Applies the existing JD analysis
 * recommendations to the existing structured resume and resolves with the
 * tailored resume (existing builder schema) plus a change summary.
 *
 * Reuses the resume PDF, JD, and analysis the app already has — the user
 * does not re-upload or re-paste anything.
 */
export async function tailorResumeStream(
  resumeFile: File,
  jobDescription: string,
  analysis: AnalysisResponse,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<TailoredResumeResult> {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("job_description", jobDescription);
  formData.append("analysis", JSON.stringify(analysis));
  return consumeSSE<TailoredResumeResult>(
    "/api/tailor-resume/stream",
    formData,
    onEvent,
    signal
  );
}
