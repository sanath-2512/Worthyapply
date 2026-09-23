"""
Import fidelity: nothing in the uploaded resume may be compressed or lost.

The structured import is produced by an LLM, which can shorten a bullet,
paraphrase it, or skip a section the schema has no obvious home for. This module
compares the structured result against the raw PDF text (the source of truth) and
repairs it deterministically — no extra LLM call:

1. Shortened / paraphrased bullets are restored to the original wording when the
   source bullet clearly corresponds to exactly one extracted bullet.
2. Source content that appears nowhere in the structured result is recovered: a
   missing bullet goes back into the entry it sat under; anything else (e.g. a
   publications/awards/languages section) goes into an "Additional information"
   activity, prefixed by its section heading — visible and editable, not dropped.

Only verbatim source text is ever inserted, so this can add back content but never
invent it.
"""

from __future__ import annotations

import re

from .grounding import strip_html, to_ul, bullets as html_bullets
from .resume_extractor import ActivityOut, ExtractedResume

_GLYPH = re.compile(r"^\s*(?:[•●▪◦‣∙·■□➢►▶✓✔➤\-\*–—]|\d{1,2}[.)])\s+")
_STOP_MARKERS = ("HYPERLINKS FOUND IN DOCUMENT", "WA DATA B64")
_YEAR = re.compile(r"\b(?:19|20)\d{2}\b|\bpresent\b|\bcurrent\b", re.IGNORECASE)
_TECH_LINE = re.compile(r"^\s*(?:technologies|tech stack|tools|stack)\s*:", re.IGNORECASE)
_STOP = frozenset("""a an the and or of to for in on at by with from into via as is are was were be been this that
these those it its their our we i my me using used""".split())


def _words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9][a-z0-9+#./%-]*", (text or "").lower()) if w not in _STOP and len(w) > 1]


def _is_heading(line: str) -> bool:
    t = line.strip()
    if not t:
        return True
    letters = [c for c in t if c.isalpha()]
    if letters and all(c.isupper() for c in letters) and len(t.split()) <= 6:
        return True
    # Entry header lines: short, carry a date, and aren't sentences.
    if _YEAR.search(t) and len(t.split()) <= 14 and not t.endswith("."):
        return True
    return bool(_TECH_LINE.match(t))


def source_segments(raw_text: str) -> list[dict]:
    """Split raw PDF text into content segments: bullets (joined across wrapped
    lines) and standalone lines. Each: {"text", "bullet": bool}."""
    lines = []
    for line in (raw_text or "").splitlines():
        if any(m in line for m in _STOP_MARKERS):
            break
        lines.append(line.rstrip())
    segs: list[dict] = []
    cur: dict | None = None
    pending_glyph = False
    for line in lines:
        t = line.strip()
        if not t:
            cur = None
            continue
        if re.fullmatch(r"[•●▪◦‣∙·■□➢►▶✓✔➤\-\*–—]", t):
            pending_glyph = True        # glyph on its own line; bullet text follows
            cur = None
            continue
        if _GLYPH.match(t) or pending_glyph:
            cur = {"text": _GLYPH.sub("", t).strip(), "bullet": True}
            segs.append(cur)
            pending_glyph = False
            continue
        if cur is not None and cur["bullet"] and not _is_heading(t):
            cur["text"] += " " + t       # wrapped continuation of the bullet
            continue
        cur = {"text": t, "bullet": False}
        segs.append(cur)
    for s in segs:
        s["text"] = " ".join(s["text"].split())
    return segs


def _structured_text(r: ExtractedResume) -> str:
    parts = list(r.personal.model_dump().values()) + [r.summary]
    for group in (r.education, r.experience, r.projects, r.certificates, r.skills, r.activities):
        for item in group:
            parts += [str(v) for v in item.model_dump().values()]
    return strip_html(" \n ".join(p for p in parts if isinstance(p, str) and p))


def _share(a: list[str], b: set[str]) -> float:
    return sum(1 for w in a if w in b) / len(a) if a else 1.0


def restore_fidelity(result: ExtractedResume, raw_text: str) -> tuple[ExtractedResume, dict]:
    """Repair `result` against the raw text. Returns (repaired copy, report)."""
    out = result.model_copy(deep=True)
    report = {"restored_bullets": 0, "recovered_segments": []}
    segs = source_segments(raw_text)
    src_bullets = [s["text"] for s in segs if s["bullet"] and len(_words(s["text"])) >= 3]

    # ---- 1. restore shortened / paraphrased bullets
    holders = []   # (obj, field) whose value is an HTML bullet list
    for group in (out.experience, out.projects, out.activities, out.certificates):
        for item in group:
            holders.append(item)
    extracted = []  # (holder, bullet index, text)
    for h in holders:
        for i, b in enumerate(html_bullets(h.description)):
            extracted.append((h, i, b))

    best_for: dict[int, list[tuple[int, float]]] = {}
    for k, (_, _, b) in enumerate(extracted):
        bw = _words(b)
        best, best_j = 0.0, -1
        for j, sb in enumerate(src_bullets):
            score = _share(bw, set(_words(sb)))
            if score > best:
                best, best_j = score, j
        if best_j >= 0 and best >= 0.6:
            best_for.setdefault(best_j, []).append((k, best))

    replacements: dict[tuple[int, int], str] = {}
    for j, hits in best_for.items():
        if len(hits) != 1:
            continue                      # several extracted bullets share it: a split, not compression
        k, _ = hits[0]
        h, i, b = extracted[k]
        sb = src_bullets[j]
        extra = set(_words(sb)) - set(_words(b))
        if len(extra) >= 2 and len(sb) > len(b):
            replacements[(id(h), i)] = sb
    if replacements:
        for h in holders:
            items = html_bullets(h.description)
            changed = False
            for i in range(len(items)):
                if (id(h), i) in replacements:
                    items[i] = replacements[(id(h), i)]
                    changed = True
            if changed:
                h.description = to_ul(items)
        report["restored_bullets"] = len(replacements)

    # ---- 2. recover content that is missing entirely
    # A missing BULLET goes back into the entry it sat under in the source (the
    # nearest preceding header line naming that entry's company/role/project).
    # Anything else goes into "Additional information", prefixed by its section
    # heading, so nothing is dropped.
    have = set(_words(_structured_text(out)))
    entries = list(out.experience) + list(out.projects) + list(out.activities)

    def entry_for(seg_index: int):
        for k in range(seg_index - 1, -1, -1):
            if segs[k]["bullet"]:
                continue
            hw = set(_words(segs[k]["text"]))
            best, best_e = 0.0, None
            for e in entries:
                ew = _words(" ".join(getattr(e, f, "") for f in ("company", "role", "name", "title")))
                sc = _share(ew, hw)
                if ew and sc > best:
                    best, best_e = sc, e
            if best >= 0.5:
                return best_e
            if all(c.isupper() for c in segs[k]["text"] if c.isalpha()):
                return None               # hit a section heading first: no owning entry
        return None

    def is_entry_header(text: str) -> bool:
        tw = set(_words(text))
        for e in entries + list(out.education) + list(out.certificates):
            ew = _words(" ".join(getattr(e, f, "") for f in ("company", "role", "name", "title",
                                                               "institution", "degree", "organisation")))
            if ew and _share(ew, tw) >= 0.6:
                return True
        return False

    section = ""
    loose: list[str] = []
    for n, s in enumerate(segs):
        text = s["text"]
        letters = [c for c in text if c.isalpha()]
        if not s["bullet"] and letters and all(c.isupper() for c in letters) and len(text.split()) <= 6:
            section = text.title()
            continue
        w = _words(text)
        if len(w) < (2 if s["bullet"] else 4) or _TECH_LINE.match(text):
            continue
        if _share(w, have) >= 0.6 or (not s["bullet"] and is_entry_header(text)):
            continue
        have |= set(w)                    # never recover the same words twice
        owner = entry_for(n) if s["bullet"] else None
        if owner is not None:
            owner.description = to_ul(html_bullets(owner.description) + [text])
            report["recovered_segments"].append(text)
        else:
            loose.append(f"{section}: {text}" if section else text)
    if loose:
        out.activities.append(ActivityOut(
            title="Additional information",
            organizations="Recovered from your original resume — move or edit as needed",
            description=to_ul(loose),
        ))
        report["recovered_segments"] += loose
    return out, report
