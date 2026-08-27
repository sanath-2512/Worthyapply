import { AnalysisResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
