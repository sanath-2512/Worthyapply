"""
Shared multi-provider LLM factory with automatic fallback.

Builds a single structured-output runnable that tries providers in order:
    Groq → Gemini → OpenRouter → Mistral → Cohere

Uses LangChain's .with_fallbacks() so when one provider errors (rate limit,
quota exhausted, key invalid), it automatically moves to the next one.

Every provider is configured to FAIL FAST (max_retries=0) so a dead provider
doesn't stall the chain with internal backoff retries.
"""

import os
from typing import Optional


def _groq():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return None
    try:
        from langchain_groq import ChatGroq
        return ChatGroq(
            model="openai/gpt-oss-120b",
            temperature=0,
            max_tokens=8000,
            max_retries=0,
            api_key=key,
        )
    except Exception:
        return None


def _gemini():
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-flash-latest",
            temperature=0,
            max_output_tokens=8192,
            max_retries=0,
            google_api_key=key,
        )
    except Exception:
        return None


def _openrouter():
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        return None
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="z-ai/glm-5.2:free",
            temperature=0,
            max_tokens=8000,
            max_retries=0,
            api_key=key,
            base_url="https://openrouter.ai/api/v1",
        )
    except Exception:
        return None


def _mistral():
    key = os.getenv("MISTRAL_API_KEY") or os.getenv("MISTIRAL_API_KEY")
    if not key:
        return None
    try:
        from langchain_mistralai import ChatMistralAI
        return ChatMistralAI(
            model="mistral-small-latest",
            temperature=0,
            max_retries=0,
            api_key=key,
        )
    except Exception:
        return None


def _cohere():
    key = os.getenv("COHERE_API_KEY")
    if not key:
        return None
    try:
        from langchain_cohere import ChatCohere
        return ChatCohere(
            model="command-r",
            temperature=0,
            cohere_api_key=key,
        )
    except Exception:
        return None


# Order: fastest/most-reliable first, then fallbacks.
_PROVIDER_BUILDERS = [_groq, _gemini, _openrouter, _mistral, _cohere]


def get_structured_llm(response_format):
    """
    Return a runnable that produces `response_format` structured output,
    with automatic fallback across all configured providers.
    Raises RuntimeError if no provider is configured.
    """
    llms = []
    for build in _PROVIDER_BUILDERS:
        llm = build()
        if llm is not None:
            try:
                llms.append(llm.with_structured_output(response_format))
            except Exception:
                continue

    if not llms:
        raise RuntimeError("No LLM provider configured. Set at least one API key.")

    primary = llms[0]
    if len(llms) > 1:
        return primary.with_fallbacks(llms[1:])
    return primary
