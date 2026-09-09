"""
Streaming helpers for the router.

- build_stream_prompt: append a JSON-schema hint (raw .stream() isn't structured).
- extract_and_validate: pull JSON from accumulated text and validate against schema.
- iter_stream_with_timeout: iterate a LangChain .stream() with a first-token and
  inactivity timeout, so a provider that connects but never emits tokens is
  abandoned quickly instead of hanging.
"""

from __future__ import annotations

import json
import queue
import re
import threading
from typing import Iterator

from .errors import SchemaValidationError


def _compact_schema(response_format) -> str:
    """
    A COMPACT field skeleton (names + JSON types only, no descriptions/$defs).

    The full Pydantic model_json_schema() for CombinedAnalysis is ~2700 tokens of
    nested definitions and long descriptions — that alone blew past Groq's free-tier
    per-minute token budget (413 Request too large). This produces the same shape
    guidance in a fraction of the tokens.
    """
    try:
        schema = response_format.model_json_schema()
    except Exception:
        return ""

    defs = schema.get("$defs", {}) or schema.get("definitions", {})

    def ref_name(ref: str) -> str:
        return ref.rsplit("/", 1)[-1]

    def render(node: dict, depth: int = 0) -> object:
        if depth > 8:
            return "string"
        if "$ref" in node:
            return render(defs.get(ref_name(node["$ref"]), {}), depth)
        # unwrap anyOf/allOf (e.g. Optional)
        for key in ("anyOf", "allOf", "oneOf"):
            if key in node:
                for opt in node[key]:
                    if opt.get("type") != "null":
                        return render(opt, depth)
        t = node.get("type")
        if t == "object" or "properties" in node:
            return {k: render(v, depth + 1) for k, v in (node.get("properties") or {}).items()}
        if t == "array":
            return [render(node.get("items", {}), depth + 1)]
        if "enum" in node:
            return "|".join(str(e) for e in node["enum"])
        return t or "string"

    try:
        return json.dumps(render(schema))
    except Exception:
        return ""


def build_stream_prompt(prompt: str, response_format) -> str:
    skeleton = _compact_schema(response_format)
    return (
        f"{prompt}\n\n"
        "Respond with ONLY a single valid JSON object with EXACTLY this shape "
        "(field names and types; fill every field). No markdown, no code fences, "
        "no commentary.\n"
        f"SHAPE:\n{skeleton}\n"
    )


def _extract_json(text: str) -> str:
    if not text:
        raise SchemaValidationError("empty response")
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise SchemaValidationError("no JSON object found in response")
    return text[start : end + 1]


def extract_and_validate(accumulated: str, response_format):
    """Extract JSON and validate against the Pydantic schema, or raise SchemaValidationError."""
    json_str = _extract_json(accumulated)
    try:
        return response_format.model_validate_json(json_str)
    except Exception as e:
        raise SchemaValidationError(f"structured output failed validation: {e}") from e


_SENTINEL_DONE = object()


def iter_stream_with_timeout(
    raw_model, full_prompt: str, first_token_timeout: float, inactivity_timeout: float
) -> Iterator[str]:
    """
    Yield text deltas from raw_model.stream(full_prompt) with timeouts.

    A background thread drives the (blocking, sync) LangChain stream and pushes
    deltas onto a queue. The consumer waits at most `first_token_timeout` for the
    first delta and `inactivity_timeout` between subsequent deltas; exceeding
    either raises TimeoutError so the router can fall back (before commit).
    """
    q: "queue.Queue" = queue.Queue()

    def _worker():
        try:
            for chunk in raw_model.stream(full_prompt):
                content = getattr(chunk, "content", "") or ""
                if not isinstance(content, str):
                    content = "".join(
                        part.get("text", "") if isinstance(part, dict) else str(part)
                        for part in content
                    )
                if content:
                    q.put(("token", content))
            q.put(("done", _SENTINEL_DONE))
        except Exception as e:  # provider/stream error
            q.put(("error", e))

    threading.Thread(target=_worker, daemon=True, name="llm-stream").start()

    first = True
    while True:
        wait = first_token_timeout if first else inactivity_timeout
        try:
            kind, payload = q.get(timeout=wait)
        except queue.Empty:
            raise TimeoutError(
                f"no {'first ' if first else ''}token within {wait:.0f}s"
            )
        first = False
        if kind == "token":
            yield payload
        elif kind == "done":
            return
        elif kind == "error":
            raise payload
