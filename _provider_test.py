"""Compare providers/models for the extraction task in isolation."""
import time, os
from dotenv import load_dotenv
load_dotenv()

from backend.resume_extractor import (
    ExtractedResume, EXTRACTION_PROMPT, extract_resume_text_from_bytes
)

with open("Recent_resume.pdf", "rb") as f:
    prompt = EXTRACTION_PROMPT.format(resume_text=extract_resume_text_from_bytes(f.read()))

def timeit(label, build):
    try:
        llm = build().with_structured_output(ExtractedResume)
        t = time.perf_counter()
        r = llm.invoke(prompt)
        dt = time.perf_counter() - t
        print(f"{label:35s} OK   {dt:6.2f}s  exp={len(r.experience)} proj={len(r.projects)} act={len(r.activities)}")
    except Exception as e:
        print(f"{label:35s} FAIL {str(e)[:90]}")

from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI

gk = os.getenv("GROQ_API_KEY")
gem = os.getenv("GEMINI_API_KEY")

timeit("groq gpt-oss-120b", lambda: ChatGroq(model="openai/gpt-oss-120b", temperature=0, max_tokens=8000, max_retries=0, api_key=gk))
timeit("groq llama-3.3-70b-versatile", lambda: ChatGroq(model="llama-3.3-70b-versatile", temperature=0, max_tokens=8000, max_retries=0, api_key=gk))
timeit("groq llama-3.1-8b-instant", lambda: ChatGroq(model="llama-3.1-8b-instant", temperature=0, max_tokens=8000, max_retries=0, api_key=gk))
timeit("gemini-flash-latest", lambda: ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0, max_output_tokens=8192, max_retries=0, google_api_key=gem))
timeit("gemini-2.0-flash", lambda: ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0, max_output_tokens=8192, max_retries=0, google_api_key=gem))
