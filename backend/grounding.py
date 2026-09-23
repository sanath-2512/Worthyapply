"""
Claim-level fact-check for generated resume text.

Every piece of generated text (a rewritten bullet, a summary, a headline) is
decomposed into the checkable claims that fabrication hides in:

    numbers & percentages · technologies · scale language ("production",
    "millions") · outcome claims ("reduced latency") · responsibility level
    ("led", "architected") · seniority ("Senior", "Lead")

Each claim must be supported by the SOURCE text it rewrites (the original entry,
or the whole resume for summary/skills). Technologies may also be supported by a
more specific technology in the source (skills.py hierarchy: "AWS Bedrock" supports
"AWS") or by an explicit licence — a JD term the analysis verified the candidate
already demonstrates (e.g. "RAG" for a document Q&A system on Bedrock).

This is deliberately deterministic: no extra LLM call, no added latency, and the
same input always gives the same verdict. It cannot judge every paraphrase, so the
tailoring prompt remains the first line of defence; this is the backstop that
guarantees the high-risk claim types never reach the user unsupported.
"""

from __future__ import annotations

import html
import re

from . import skills as S

# ---------------------------------------------------------------- text helpers
_TAG = re.compile(r"<[^>]+>")
_LI = re.compile(r"<li[^>]*>(.*?)</li>", re.IGNORECASE | re.DOTALL)


def strip_html(text: str) -> str:
    return " ".join(html.unescape(_TAG.sub(" ", text or "")).split())


def bullets(desc_html: str) -> list[str]:
    """The bullet texts of an HTML description (falls back to one block)."""
    items = [strip_html(m) for m in _LI.findall(desc_html or "")]
    items = [i for i in items if i]
    if items:
        return items
    plain = strip_html(desc_html)
    return [plain] if plain else []


def to_ul(items: list[str]) -> str:
    return "<ul>" + "".join(f"<li>{html.escape(i, quote=False)}</li>" for i in items) + "</ul>"


# ---------------------------------------------------------------- claim patterns
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")

_SCALE = re.compile(
    r"\b(production(?:-grade|-ready)?|large[- ]scale|at scale|enterprise[- ](?:scale|grade)|"
    r"high[- ](?:traffic|volume|throughput|availability)|mission[- ]critical|"
    r"millions?|billions?|thousands|company[- ]wide|org(?:anization)?[- ]wide)\b",
    re.IGNORECASE,
)

_OUTCOME_VERB = r"(?:reduc|improv|increas|boost|cut|sav|accelerat|decreas|lower|grew|grow|optimi[sz]|speed(?:ing)? up|enhanc|maximi[sz]|minimi[sz])\w*"
_OUTCOME_NOUN = (
    r"(latency|performance|efficiency|revenue|costs?|time|throughput|conversion|engagement|reliability|"
    r"speed|accuracy|retention|errors?|downtime|uptime|load times?|response times?|productivity|sales|churn)"
)
_OUTCOME = re.compile(rf"\b{_OUTCOME_VERB}\b(?:\W+\w+){{0,4}}?\W+{_OUTCOME_NOUN}\b", re.IGNORECASE)

_ESCALATION = re.compile(
    r"\b(led|lead|leading|managed|manag(?:ing|es)|headed|spearhead\w*|architect(?:ed|ing)?|owned|own(?:ing)?|"
    r"directed|oversaw|overs(?:ee|aw|eeing)|mentor(?:ed|ing)?|supervis\w*|drove|championed)\b",
    re.IGNORECASE,
)

_SENIORITY = re.compile(r"\b(senior|sr\.?|lead|principal|staff|head|manager|director|chief|vp|architect)\b", re.IGNORECASE)


def _stems(pattern: re.Pattern, text: str) -> set[str]:
    return {m.group(0).lower()[:5] for m in pattern.finditer(text or "")}


def _outcome_nouns(text: str) -> set[str]:
    return {m.group(1).lower().rstrip("s") for m in _OUTCOME.finditer(text or "")}


def unsupported_claims(new_text: str, source: str, licensed: set[str] | frozenset = frozenset()) -> list[str]:
    """Claims in `new_text` that `source` does not support. Empty list = grounded.

    `licensed` holds skill keys (skills.py) that are allowed even though the
    source does not name them (JD terminology the analysis verified).
    """
    new = strip_html(new_text)
    src = strip_html(source)
    reasons: list[str] = []

    src_numbers = set(_NUMBER.findall(src))
    for n in _NUMBER.findall(new):
        if n not in src_numbers:
            reasons.append(f"number '{n}' is not in the original")

    supported = S.evidenced(src)
    for key in S.find_skills(new):
        if key not in supported and key not in licensed:
            reasons.append(f"'{S.label(key)}' is not evidenced here")

    src_low = src.lower()
    for m in _SCALE.finditer(new):
        phrase = m.group(0).lower()
        if phrase not in src_low:
            reasons.append(f"scale claim '{m.group(0)}' is not in the original")

    src_outcomes = _outcome_nouns(src) | {w.rstrip("s") for w in re.findall(r"[a-z]+", src_low)}
    for noun in _outcome_nouns(new):
        if noun not in src_outcomes:
            reasons.append(f"outcome claim about '{noun}' is not in the original")

    src_esc = _stems(_ESCALATION, src)
    for m in _ESCALATION.finditer(new):
        if m.group(0).lower()[:5] not in src_esc:
            reasons.append(f"responsibility '{m.group(0)}' is stronger than the original")

    return reasons


def lost_facts(original_html: str, new_html: str) -> list[str]:
    """Hard facts (numbers, concrete technologies) in the original that the rewrite
    dropped. Concept words ("backend", "APIs") are excluded — rewording them into
    the JD's terms is the point of tailoring."""
    orig, new = strip_html(original_html), strip_html(new_html)
    lost = [f"number '{n}'" for n in set(_NUMBER.findall(orig)) - set(_NUMBER.findall(new))]
    tools = lambda t: {k for k in S.find_skills(t) if S.SKILLS[k].tier == "tool"}
    lost += [f"'{S.label(k)}'" for k in tools(orig) - tools(new)]
    return sorted(lost)


def unsupported_seniority(new_title: str, source: str) -> list[str]:
    src = strip_html(source).lower()
    return [
        f"seniority '{m.group(0)}' is not in the original"
        for m in _SENIORITY.finditer(new_title or "")
        if m.group(0).lower().rstrip(".") not in src
    ]


def quote_supported(quote: str, source: str, threshold: float = 0.6) -> bool:
    """True when most content words of an evidence quote occur in the source —
    i.e. the model's cited evidence actually comes from the resume."""
    words = [w for w in re.findall(r"[a-z0-9+#.]+", (quote or "").lower()) if len(w) > 2]
    if not words:
        return False
    src = strip_html(source).lower()
    hits = sum(1 for w in words if w in src)
    return hits / len(words) >= threshold
