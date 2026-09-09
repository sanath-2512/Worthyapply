"""
Provider adapters — a consistent interface over each LangChain chat model.

Preserves the EXACT models/keys/params previously used in backend/llm.py:
    groq       openai/gpt-oss-120b
    gemini     gemini-3.6-flash
    openrouter z-ai/glm-5.2          (base_url = openrouter.ai/api/v1)
    mistral    mistral-small-latest
    cohere     command-a-03-2025

All providers: temperature=0, max_retries=0 (fail fast; the router owns retries),
and the SDK timeout set from config (a second line of defense under the router's
own hard wall-clock timeout).
"""

from __future__ import annotations

import os
from typing import Optional

from .config import ProviderSettings


class LLMProvider:
    """Common interface the router uses to talk to any provider."""

    name: str
    model: str

    def __init__(self, settings: ProviderSettings):
        self.settings = settings
        self.name = settings.name
        self.timeout = settings.timeout
        self.priority = settings.priority

    # --- to be implemented per provider ---
    def _api_key(self) -> Optional[str]:  # pragma: no cover - trivial
        raise NotImplementedError

    def _build(self):  # returns a LangChain BaseChatModel, or raises
        raise NotImplementedError

    # --- shared ---
    def is_configured(self) -> bool:
        return bool(self._api_key())

    def build_raw(self):
        """Raw chat model (for streaming)."""
        return self._build()

    def build_structured(self, response_format):
        """Chat model with structured output bound to the given schema."""
        return self._build().with_structured_output(response_format)


class GroqProvider(LLMProvider):
    model = "openai/gpt-oss-120b"

    def _api_key(self):
        return os.getenv("GROQ_API_KEY")

    def _build(self):
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=self.model,
            temperature=0,
            max_tokens=8000,
            max_retries=0,
            timeout=self.timeout,
            api_key=self._api_key(),
        )


class GeminiProvider(LLMProvider):
    # `gemini-flash-latest` is an alias that always resolves to a current Flash
    # model, avoiding breakage when specific dated model names are retired.
    model = "gemini-flash-latest"

    def _api_key(self):
        return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    def _build(self):
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=self.model,
            temperature=0,
            max_output_tokens=8192,
            max_retries=0,
            timeout=self.timeout,
            google_api_key=self._api_key(),
        )


class OpenRouterProvider(LLMProvider):
    model = "z-ai/glm-5.2"

    def _api_key(self):
        return os.getenv("OPENROUTER_API_KEY")

    def _build(self):
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=self.model,
            temperature=0,
            max_tokens=8000,
            max_retries=0,
            timeout=self.timeout,
            api_key=self._api_key(),
            base_url="https://openrouter.ai/api/v1",
        )


class MistralProvider(LLMProvider):
    model = "mistral-small-latest"

    def _api_key(self):
        return os.getenv("MISTRAL_API_KEY") or os.getenv("MISTIRAL_API_KEY")

    def _build(self):
        from langchain_mistralai import ChatMistralAI
        return ChatMistralAI(
            model=self.model,
            temperature=0,
            max_retries=0,
            timeout=self.timeout,
            # Allow enough room for the large CombinedAnalysis JSON so the output
            # is not truncated mid-object (which would fail schema validation).
            max_tokens=8000,
            api_key=self._api_key(),
        )


class CohereProvider(LLMProvider):
    # `command-r` was removed by Cohere on 2025-09-15; use a current model.
    model = "command-a-03-2025"

    def _api_key(self):
        return os.getenv("COHERE_API_KEY")

    def _build(self):
        from langchain_cohere import ChatCohere
        return ChatCohere(
            model=self.model,
            temperature=0,
            timeout_seconds=int(self.timeout),
            max_tokens=8000,
            cohere_api_key=self._api_key(),
        )


_PROVIDER_CLASSES = {
    "groq": GroqProvider,
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
    "mistral": MistralProvider,
    "cohere": CohereProvider,
}


def build_providers(config) -> dict[str, LLMProvider]:
    """Instantiate all provider adapters that have a class defined."""
    providers: dict[str, LLMProvider] = {}
    for name, settings in config.providers.items():
        cls = _PROVIDER_CLASSES.get(name)
        if cls is not None:
            providers[name] = cls(settings)
    return providers
