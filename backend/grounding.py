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

Claims come in two severities (classify_claims):

  SOFT — a skill/technology or new wording the source doesn't state. Kept, but
         surfaced as an alert so the candidate confirms it before sending.
  HARD — an invented number, scale, outcome, stronger ownership or seniority.
         Removed: these are specific statements about achievements that an alert
         cannot make true, and they do not affect the match score anyway.

Deterministic: no extra LLM call, no added latency, same input -> same verdict.
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


HARD_KINDS = frozenset({"number", "scale", "outcome", "ownership", "seniority"})

# Words that carry no factual claim on their own — rewording with them is fine.
_NEUTRAL = frozenset("""
a an the and or of to for in on at by with from into via as is are was were be been being this that these those
their its it they we our using used use built build building developed develop developing created create creating
implemented implement implementing worked work working helped help supported support wrote write writing made make
set setup up out new also across within through while which who various multiple several key core based including
designed design designing delivered deliver enabled enable ensured ensure improved maintained maintain managed
handled handle integrated integrate applied apply leveraged leverage utilized utilize contributed contributing
responsible end team teams project projects system systems application applications app apps feature features
""".split())

# Generic resume vocabulary: describes process or general objects, not a new
# capability. Not reported as new wording (coverage checks still count it).
_GENERIC = frozenset("""
before after during every each all any both other various consistent local internal external existing new daily
weekly regular ongoing overall related relevant own custom general common simple clean clear
development release releases codebase code practices findings insights visibility communicate communicated
provide provided produce produced gave give run running ran process processes workflow workflows task tasks
data dataset datasets analysis analyze analyzed report reports reporting documentation documented document
platform company website web tool tools module modules component components service services solution solutions
stakeholders requirements collaborated collaborate collaborating partnered communication cross-functional
functionality capabilities environment environments setup configuration configured version versions
""".split())


def _content_words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9][a-z0-9+#./-]*[a-z0-9+#]|[a-z0-9]", (text or "").lower())
            if len(w) > 2 and w not in _NEUTRAL]


def _stem(word: str) -> str:
    # Crude but deterministic: "analyzed"/"analysis", "containerized"/"containers".
    return word[:5] if len(word) > 5 else word


def _word_parts(words) -> set[str]:
    out = set()
    for w in words:
        out.add(w)
        out.update(p for p in re.split(r"[-/.]", w) if len(p) > 2)
    return out


_TECHY = re.compile(r"\b(?:[A-Z][a-z]+[A-Z][A-Za-z]+|[A-Za-z]+\d[A-Za-z0-9]*|[A-Za-z]+\.(?:js|io|ai|net)|[A-Z]{2,6}s?)\b")


def classify_claims(new_text: str, source: str, licensed: set[str] | frozenset = frozenset(),
                    context: str = "") -> list[dict]:
    """Every claim in `new_text` that `source` does not support, as
    {"kind", "text", "severity"} with severity 'hard' or 'soft'.

    `licensed` holds skill keys allowed without being named in the source (JD
    terminology the analysis verified). `context` is extra text whose words are
    not reported as *new wording* (e.g. the JD, for terminology) — it never
    licenses a hard claim.
    """
    new = strip_html(new_text)
    src = strip_html(source)
    out: list[dict] = []

    def add(kind: str, text: str):
        item = {"kind": kind, "text": text, "severity": "hard" if kind in HARD_KINDS else "soft"}
        if item not in out:
            out.append(item)

    src_numbers = set(_NUMBER.findall(src))
    for n in _NUMBER.findall(new):
        if n not in src_numbers:
            add("number", n)

    supported = S.evidenced(src)
    new_skill_keys = S.find_skills(new)
    for key in new_skill_keys:
        if key not in supported and key not in licensed:
            add("skill", S.label(key))

    # Technology-looking names outside the lexicon (CamelCase, digits, .js, acronyms).
    src_low = src.lower()
    known_labels = {l.lower() for k in new_skill_keys for l in S.SKILLS[k].labels + S.SKILLS[k].case_sensitive}
    for m in _TECHY.finditer(new):
        tok = m.group(0)
        low = tok.lower()
        if low in src_low or _NUMBER.fullmatch(tok) or any(low in lab for lab in known_labels):
            continue
        key = S.canonical(tok)
        if key is not None and (key in supported or key in licensed or key in new_skill_keys):
            continue
        add("skill", tok)

    for m in _SCALE.finditer(new):
        if m.group(0).lower() not in src_low:
            add("scale", m.group(0))

    src_outcomes = _outcome_nouns(src) | {w.rstrip("s") for w in re.findall(r"[a-z]+", src_low)}
    for noun in _outcome_nouns(new):
        if noun not in src_outcomes:
            add("outcome", noun)

    src_esc = _stems(_ESCALATION, src)
    for m in _ESCALATION.finditer(new):
        if m.group(0).lower()[:5] not in src_esc:
            add("ownership", m.group(0))

    # Plain-language additions (e.g. "…and take online orders"): content words the
    # source doesn't contain. Soft — reported for the candidate to confirm.
    allowed = _word_parts(_content_words(src)) | _word_parts(_content_words(context))
    for key in licensed | new_skill_keys:
        for lab in S.SKILLS[key].labels + S.SKILLS[key].case_sensitive if key in S.SKILLS else ():
            allowed |= _word_parts(_content_words(lab))
    allowed_stems = {_stem(w) for w in allowed}
    flagged = {c["text"].lower() for c in out}

    def is_new(w: str) -> bool:
        if w in _GENERIC or re.fullmatch(_OUTCOME_VERB, w) or _ESCALATION.fullmatch(w):
            return False                  # outcome / ownership words have their own (hard) checks
        parts = [p for p in re.split(r"[-/.]", w) if len(p) > 2 and p not in _NEUTRAL | _GENERIC] or [w]
        return all(p not in allowed and _stem(p) not in allowed_stems for p in parts)

    novel = [w for w in dict.fromkeys(_content_words(new)) if w not in flagged
             and not _NUMBER.fullmatch(w) and is_new(w)]
    if novel:
        add("wording", ", ".join(novel[:8]))
    return out


def unsupported_claims(new_text: str, source: str, licensed: set[str] | frozenset = frozenset()) -> list[str]:
    """Hard + skill claims in `new_text` that `source` does not support, as readable
    reasons. Empty list = grounded. (New plain wording is not counted here.)"""
    msgs = {
        "number": "number '{}' is not in the original",
        "skill": "'{}' is not evidenced here",
        "scale": "scale claim '{}' is not in the original",
        "outcome": "outcome claim about '{}' is not in the original",
        "ownership": "responsibility '{}' is stronger than the original",
    }
    return [msgs[c["kind"]].format(c["text"]) for c in classify_claims(new_text, source, licensed)
            if c["kind"] in msgs]


def coverage(original: str, candidates: list[str]) -> tuple[float, int]:
    """Best share of `original`'s content words found in any one candidate, and
    that candidate's index (-1 if none)."""
    words = set(_content_words(strip_html(original)))
    if not words:
        return 1.0, -1
    best, idx = 0.0, -1
    for i, c in enumerate(candidates):
        cw = set(_content_words(strip_html(c)))
        score = len(words & cw) / len(words)
        if score > best:
            best, idx = score, i
    return best, idx


def facts(text: str) -> tuple[set[str], set[str]]:
    """Hard facts in text: numbers, and concrete technologies (tool tier)."""
    t = strip_html(text)
    return set(_NUMBER.findall(t)), {k for k in S.find_skills(t) if S.SKILLS[k].tier == "tool"}


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
