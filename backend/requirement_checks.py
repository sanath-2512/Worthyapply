"""
Deterministic checks for the requirement types skills.py can't rule on:
OR-groups, years of experience, and degree level.

All three are UPGRADE-ONLY when the resume text gives a positive answer (a
listed alternative is named; dated roles add up to enough years; a degree at
or above the required level is present). When the resume can't settle it the
model's verdict stands — date formats and degree names vary too much to justify
downgrading on a parse that found nothing.
"""

from __future__ import annotations

import datetime as _dt
import re

from . import skills as S

# ---------------------------------------------------------------- OR-groups
_OR_SPLIT = re.compile(r"\s*(?:,|/|\bor\b|\||;)\s*", re.IGNORECASE)
_OR_FILLER = re.compile(r"^(?:experience|proficiency|familiarity|knowledge|expertise)\s+(?:with|in|of)\s+|"
                        r"^(?:one of|any of|either|such as|e\.g\.?|like)\s+|\s+(?:or similar|or equivalent|etc\.?)$",
                        re.IGNORECASE)


def or_options(requirement: str, evidence_hint: list[str] | None = None) -> list[str]:
    """The alternatives of an OR requirement ("React, Vue or Angular")."""
    parts = [_OR_FILLER.sub("", p).strip(" .") for p in _OR_SPLIT.split(requirement or "")]
    opts = [p for p in parts if p]
    for h in evidence_hint or []:
        if h and h not in opts:
            opts.append(h)
    return opts


def satisfied_option(options: list[str], resume_text: str) -> tuple[str, str] | None:
    """(option, how) for the first option the resume evidences, else None."""
    for opt in options:
        if S.canonical(opt) is None:
            continue
        how = S.support_for(opt, resume_text)
        if how:
            return opt, how
    return None


# ---------------------------------------------------------------- years
_MONTHS = {m: i for i, m in enumerate(
    "jan feb mar apr may jun jul aug sep oct nov dec".split(), start=1)}
_MON = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_POINT = rf"(?:{_MON}\s*,?\s*(?:19|20)\d{{2}}|(?:0?[1-9]|1[0-2])\s*[/.-]\s*(?:19|20)\d{{2}}|(?:19|20)\d{{2}})"
_NOW = r"(?:present|current|now|today|ongoing|date)"
_RANGE = re.compile(rf"({_POINT})\s*(?:-|–|—|to|until|till)\s*({_POINT}|{_NOW})", re.IGNORECASE)
_EDU_WORDS = re.compile(
    r"\b(university|college|school|institute|academy|b\.?\s?tech|b\.\s?e\.|b\.?\s?sc?|bachelor|m\.?\s?tech|"
    r"m\.?\s?sc?|master|mba|ph\.?\s?d|degree|diploma|gpa|cgpa|coursework|semester|class of)(?!\w)", re.IGNORECASE)
_HEADING = re.compile(r"^[^a-z]*[A-Z][^a-z]*$")


def _point(text: str, end: bool, today: _dt.date) -> tuple[int, int] | None:
    t = text.strip().lower()
    if re.fullmatch(_NOW, t):
        return today.year, today.month
    y = re.search(r"(?:19|20)\d{2}", t)
    if not y:
        return None
    year = int(y.group(0))
    mon = re.match(r"[a-z]{3}", t)
    if mon and mon.group(0) in _MONTHS:
        return year, _MONTHS[mon.group(0)]
    num = re.match(r"(\d{1,2})\s*[/.-]", t)
    if num:
        return year, int(num.group(1))
    return year, 12 if end else 1


def work_intervals(resume_text: str, today: _dt.date | None = None) -> list[tuple[int, int]]:
    """Dated work periods as (start, end) month indices, education excluded."""
    today = today or _dt.date.today()
    out: list[tuple[int, int]] = []
    in_edu = False
    for line in (resume_text or "").splitlines():
        s = line.strip()
        if s and _HEADING.match(s) and len(s.split()) <= 5:
            in_edu = "EDUCATION" in s.upper() or "ACADEMIC" in s.upper()
            continue
        if in_edu or _EDU_WORDS.search(s):
            continue
        for m in _RANGE.finditer(s):
            a, b = _point(m.group(1), False, today), _point(m.group(2), True, today)
            if not a or not b:
                continue
            start, end = a[0] * 12 + a[1] - 1, b[0] * 12 + b[1]
            if 0 < end - start <= 12 * 45:
                out.append((start, end))
    return out


def total_years(resume_text: str, today: _dt.date | None = None) -> float:
    """Years covered by dated work periods, overlaps merged."""
    spans = sorted(work_intervals(resume_text, today))
    months, cur_s, cur_e = 0, None, None
    for s, e in spans:
        if cur_e is None or s > cur_e:
            if cur_e is not None:
                months += cur_e - cur_s
            cur_s, cur_e = s, e
        else:
            cur_e = max(cur_e, e)
    if cur_e is not None:
        months += cur_e - cur_s
    return round(months / 12, 1)


_YEARS_REQ = re.compile(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)", re.IGNORECASE)


def years_required(requirement: str) -> float | None:
    m = _YEARS_REQ.search(requirement or "")
    return float(m.group(1)) if m else None


# ---------------------------------------------------------------- degrees
_LEVELS = [
    (3, re.compile(r"\b(ph\.?\s?d|doctorate|doctoral|d\.?phil)(?!\w)", re.IGNORECASE)),
    (2, re.compile(r"\b(master'?s?|m\.?\s?tech|m\.\s?e\.|m\.?\s?s\.?c?\b|mca|mba|m\.?\s?eng|ms in)(?!\w)", re.IGNORECASE)),
    (1, re.compile(r"\b(bachelor'?s?|b\.?\s?tech|b\.\s?e\.|b\.?\s?s\.?c?\b|bca|b\.?\s?a\.|b\.?\s?eng|"
                   r"undergraduate degree|4-year degree|four-year degree)(?!\w)", re.IGNORECASE)),
]


def degree_level(text: str) -> int:
    """Highest degree level named: 3 PhD, 2 Master's, 1 Bachelor's, 0 none."""
    for level, rx in _LEVELS:
        if rx.search(text or ""):
            return level
    return 0


def education_text(resume_text: str) -> str:
    """Lines of the resume that describe education."""
    keep, in_edu = [], False
    for line in (resume_text or "").splitlines():
        s = line.strip()
        if s and _HEADING.match(s) and len(s.split()) <= 5:
            in_edu = "EDUCATION" in s.upper() or "ACADEMIC" in s.upper()
            continue
        if in_edu or _EDU_WORDS.search(s):
            keep.append(s)
    return "\n".join(keep)


_FIELD = re.compile(r"\bin\s+([A-Za-z &/,-]+?)(?:\s+or\s+(?:a\s+)?(?:related|equivalent|similar)|[.;(]|$)", re.IGNORECASE)
_STEM = re.compile(r"\b(computer|software|information|electronics?|electrical|engineering|science|mathematics|"
                   r"maths?|statistics|physics|data|technology|it)\b", re.IGNORECASE)


def degree_check(requirement: str, resume_text: str) -> str | None:
    """'matched' / 'partial' when the resume shows a degree at or above the
    required level (partial = level fine, field not shown); None = can't tell."""
    need = degree_level(requirement)
    if need == 0:
        return None
    edu = education_text(resume_text)
    have = degree_level(edu)
    if have < need:
        return None
    m = _FIELD.search(requirement)
    if not m:
        return "matched"
    field_words = {w for w in re.findall(r"[a-z]{3,}", m.group(1).lower()) if w not in {"and", "the", "field"}}
    edu_low = edu.lower()
    if any(w in edu_low for w in field_words):
        return "matched"
    related = re.search(r"\b(related|equivalent|similar|technical|quantitative|stem)\b", requirement, re.IGNORECASE)
    if related and _STEM.search(edu):
        return "matched"
    return "partial"
