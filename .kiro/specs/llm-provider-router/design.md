# Design — Production-Grade Multi-Provider LLM Router

## 1. Overview

Replace the current `.with_fallbacks()`-based provider chain in `backend/llm.py`
with a real **provider-routing layer** that:

- fails fast on a bad/slow provider (hard per-provider timeout),
- tracks per-provider health and opens a **circuit breaker** so a known-bad
  provider is skipped on subsequent requests,
- classifies errors (timeout / rate-limit / auth / server / validation) and
  applies error-specific cooldowns,
- selects the best currently-healthy provider by a simple deterministic score,
- treats invalid structured output as a provider failure (schema-level fallback),
- is safe under concurrency,
- is observable and fully configurable.

**Non-goal:** rewriting the application into async, adding Redis, or changing any
prompt/schema/endpoint. The router is infrastructure *underneath* the two existing
public functions.

### The core problem being solved

Today, when Groq's quota is exhausted or it hangs, a request can block ~2.5 min
because (a) there is no reliable per-request wall-clock timeout across the fallback
chain, and (b) every request re-tries the dead provider from scratch. The router
fixes both: a hard `asyncio.wait_for`-equivalent timeout per attempt, plus a circuit
breaker that skips a provider entirely once it has failed repeatedly.

## 2. Existing architecture (inspected)

- **Integration surface = two functions in `backend/llm.py`:**
  - `get_structured_llm(response_format)` → returns a LangChain runnable; callers do
    `.invoke(prompt)`. Used by `pipeline._run_agent` and `resume_extractor.extract_resume`.
  - `stream_structured_llm(prompt, response_format)` → generator yielding
    `{"type":"token","text":...}` then `{"type":"result","value":<pydantic>}`. Used by
    `pipeline` streaming, `resume_extractor`, `resume_tailor`.
- **4 call sites total**, all via `from .llm import ...`. No other module builds providers.
- **Synchronous** LangChain (`langchain` 1.3.x + `langchain-groq/-google-genai/-openai/
  -mistralai/-cohere`). Called from FastAPI SSE endpoints through `asyncio.to_thread`.
- **Providers/models currently configured (preserve these):**
  - groq: `openai/gpt-oss-120b`, gemini: `gemini-flash-latest`,
    openrouter: `z-ai/glm-5.2:free`, mistral: `mistral-small-latest`,
    cohere: `command-a-03-2025`.
- **Keys (env, preserve):** `GROQ_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`,
  `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`/`MISTIRAL_API_KEY`, `COHERE_API_KEY`.
- **No config system, no Redis, single Uvicorn instance.**

### Key design constraint: sync, not async

The app calls the LLM synchronously inside worker threads. So the "hard timeout"
cannot rely on `asyncio.wait_for` at the call site. Instead the router runs each
provider attempt in a **dedicated thread with a join-timeout** (`concurrent.futures`),
giving a true wall-clock cap even if the SDK ignores its own `timeout`. This is the
mechanism that guarantees "no 2.5-minute hang." (The SDK `timeout=` is kept as a
second line of defense.)

## 3. Module layout

New package `backend/llm_router/` (keeps everything under the existing `backend/`):

```
backend/llm_router/
    __init__.py         # exposes the router singleton + public helpers
    config.py           # LLMConfig: env-driven timeouts, priorities, thresholds
    errors.py           # ErrorType enum + classify_error()
    health.py           # ProviderHealth + HealthRegistry (thread-safe)
    circuit_breaker.py  # CircuitBreaker state machine (CLOSED/OPEN/HALF_OPEN)
    providers.py        # LLMProvider base + 5 adapters (build LangChain models)
    router.py           # ProviderRouter: selection, timeout, fallback, streaming
```

`backend/llm.py` becomes a thin **compatibility shim** that re-exports
`get_structured_llm` and `stream_structured_llm` implemented on top of the router.
No call site changes.

## 4. Configuration (`config.py`)

`LLMConfig` reads env vars with sane defaults (nothing hardcoded across files):

| Env var | Default | Meaning |
|---|---|---|
| `LLM_GROQ_TIMEOUT` | 20 | per-attempt seconds (structured JSON is big; generous) |
| `LLM_GEMINI_TIMEOUT` | 25 | |
| `LLM_OPENROUTER_TIMEOUT` | 30 | |
| `LLM_MISTRAL_TIMEOUT` | 25 | |
| `LLM_COHERE_TIMEOUT` | 25 | |
| `LLM_{PROVIDER}_PRIORITY` | 1..5 | groq=1 … cohere=5 |
| `LLM_CIRCUIT_FAILURE_THRESHOLD` | 3 | consecutive failures → OPEN |
| `LLM_CIRCUIT_COOLDOWN_SECONDS` | 60 | OPEN duration before HALF_OPEN |
| `LLM_COOLDOWN_TIMEOUT` | 20 | cooldown after a timeout |
| `LLM_COOLDOWN_RATE_LIMIT` | 60 | cooldown after 429 |
| `LLM_COOLDOWN_SERVER_ERROR` | 20 | cooldown after 5xx |
| `LLM_COOLDOWN_AUTH` | 900 | long cooldown after 401/403 |
| `LLM_ENABLE_FALLBACK` | true | if false, only best provider is tried |

> Timeouts are deliberately higher than the prompt's 10s example because our calls
> return large structured JSON (resume/analysis). Values are env-tunable; the point
> is a *bounded* wait, not a specific number. Documented as a tunable assumption.

## 5. Error classification (`errors.py`)

```python
class ErrorType(str, Enum):
    TIMEOUT; RATE_LIMIT; AUTH; SERVER_ERROR; VALIDATION; UNKNOWN
```

`classify_error(exc)` inspects exception type + message + any `status_code`:
- `TimeoutError`/`FuturesTimeout` → TIMEOUT
- status 429 or "rate limit"/"quota"/"tokens per minute" → RATE_LIMIT
- status 401/403 or "invalid api key"/"unauthorized" → AUTH
- status 500/502/503/504 or 413 "request too large" (Groq TPM) → SERVER_ERROR/RATE_LIMIT
- our own `SchemaValidationError` (invalid structured output) → VALIDATION
- else UNKNOWN

Each `ErrorType` maps to a cooldown from config. AUTH gets the long cooldown.

## 6. Circuit breaker (`circuit_breaker.py`)

Per-provider state machine:
- **CLOSED**: normal. Failures increment `consecutive_failures`; at
  `FAILURE_THRESHOLD` → **OPEN** with `open_until = now + COOLDOWN`.
- **OPEN**: provider skipped by selection until `open_until`. After that →
  **HALF_OPEN**.
- **HALF_OPEN**: allow exactly **one** trial request (guarded by a lock). Success →
  CLOSED (reset counters); failure → OPEN again.

Error-specific cooldowns (from classification) can override the base cooldown (e.g.
429 → longer, timeout → shorter) so a rate-limited provider stays out longer than a
briefly-slow one.

## 7. Health tracking (`health.py`)

```python
@dataclass
class ProviderHealth:
    successes, failures, consecutive_failures: int
    timeout_failures, rate_limit_failures, server_error_failures, auth_failures: int
    ewma_latency_ms: float          # exponentially-weighted avg latency
    last_success, last_failure: float
    cooldown_until: float
    circuit: CircuitBreaker
```

`HealthRegistry` holds one `ProviderHealth` per provider behind a single
`threading.Lock` (state is small; lock contention negligible). It exposes
`record_success(name, latency_ms)` and `record_failure(name, error_type)` which also
drive the circuit breaker. **Thread-safe** because calls originate from
`asyncio.to_thread` worker threads (concurrency requirement).

> Distributed note: in-memory registry is per-process. Documented limitation. The
> registry is written behind one interface so a future `RedisHealthRegistry` can be
> swapped in without touching the router.

## 8. Provider abstraction (`providers.py`)

```python
class LLMProvider:
    name: str
    model: str
    timeout: float
    priority: int
    def build_structured(self, schema) -> Runnable   # .with_structured_output
    def build_raw(self) -> BaseChatModel              # for streaming
    def is_configured(self) -> bool                   # key present
```

Five adapters reuse the **exact** current model names/keys/params (max_retries=0,
temperature=0, per-provider `timeout`). This is a refactor of today's builder
functions into classes — no behavior change at the SDK level.

## 9. Router (`router.py`) — the heart

### Selection algorithm (deterministic, explainable)
Candidates = configured providers whose circuit is not OPEN (HALF_OPEN allowed for a
single trial). Score each; **lower = better**:

```
score = priority*10  +  ewma_latency_ms/1000  +  consecutive_failures*5
```
Optional task-type bias: if `TASK_PREFERENCES[task_type]` lists a provider, subtract a
small bonus so preferred providers sort first. Sort ascending → ordered candidate list.

### Invocation with hard timeout + fallback (non-streaming)
```
for provider in ordered_candidates:
    if circuit.should_skip(): continue
    t0 = now
    try:
        result = run_in_thread_with_timeout(provider.invoke, prompt, timeout=provider.timeout)
        validate_schema(result)                 # invalid -> raise SchemaValidationError
        health.record_success(provider, latency)
        return RouterResult(value=result, provider=..., fallback_used=..., latency_ms=...)
    except Exception as e:
        etype = classify_error(e)
        health.record_failure(provider, etype)  # drives circuit + cooldown
        log(structured); continue                # -> next provider
raise AllProvidersFailedError(controlled)         # Test 7
```

`run_in_thread_with_timeout` uses a `ThreadPoolExecutor` + `future.result(timeout)`.
On timeout it records TIMEOUT and moves on immediately (the orphaned thread is
abandoned; the SDK `timeout` + `max_retries=0` bound its lifetime). **This is what
kills the 2.5-min hang** even for sync SDKs that ignore their own timeout.

### Streaming (`stream_structured`)
Preserves the current generator contract (`token`/`result`). Adds a **first-token
timeout**: wrap the stream iterator so if no token arrives within
`provider.timeout`, we abandon that provider and fall back — but **only before any
token has been yielded to the caller**. Once tokens are committed we do NOT switch
providers (no unsafe stream-splicing); a mid-stream failure surfaces as an error the
existing SSE layer already handles (`agent_error`). Final accumulated JSON is parsed
and schema-validated; a parse failure *before* first token → fallback, after → error.

## 10. Compatibility shim (`backend/llm.py`)

```python
from .llm_router import router
def get_structured_llm(response_format):
    # returns an object with .invoke(prompt) that calls router.invoke(...)
def stream_structured_llm(prompt, response_format):
    yield from router.stream_structured(prompt, response_format)
```
`get_structured_llm` returns a tiny `_RouterRunnable` wrapper exposing `.invoke(prompt)`
so the existing `llm.invoke(prompt)` call sites keep working unchanged. Raises the same
`RuntimeError` when no provider is configured.

## 11. Observability
Structured log per attempt (logger `worthyapply.llm_router`): provider, model,
task_type, latency_ms, success, error_type, circuit_state, fallback_used/from/to.
Never logs keys or resume/prompt content.

## 12. Testing strategy (mirrors the 9 required scenarios)
Unit tests with **fake providers** (no network): success, timeout→fallback,
429→cooldown, 3× fail→circuit OPEN→skip, OPEN→cooldown→HALF_OPEN→success→CLOSED,
groq+gemini fail→openrouter, all fail→controlled error, invalid schema→fallback,
concurrent requests (threads) keep health consistent. Plus a timing assertion: a
provider that sleeps > timeout returns via fallback in ~timeout, not minutes.

## 13. Migration & preservation
- Add `backend/llm_router/`; convert `backend/llm.py` to a shim. No call-site edits.
- `.env.example` documents the new tunables (keys unchanged).
- Existing prompts, schemas, parsers, endpoints, frontend: untouched.

## 14. Assumptions / limitations
- In-memory health = per-process (single instance today); Redis-swappable later.
- Timeout on sync SDK abandons the worker thread (bounded by SDK timeout + no retry).
- Timeout defaults tuned for large structured JSON; env-tunable.
- OpenRouter treated as one provider (it may sub-route internally — opaque to us).
