/**
 * Allowlist sanitizer for the resume's rich-text fields.
 *
 * These fields are rendered with `dangerouslySetInnerHTML` and their HTML comes
 * from two untrusted-ish places: text the user pastes into the contentEditable
 * editor, and HTML the model emits when it extracts or tailors a resume from an
 * uploaded PDF. Either can carry markup the editor itself would never produce.
 *
 * Only the formatting the editor can create is kept (bold, italic, lists, links,
 * paragraphs, line breaks); everything else is unwrapped or dropped, so legitimate
 * content renders exactly as before.
 */

const ALLOWED_TAGS = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "A", "SPAN", "DIV",
]);

/** Tags whose text content is kept but whose element is removed entirely. */
const DROP_WITH_CONTENT = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "SVG", "MATH",
]);

function isSafeHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  // Block javascript:, data:, vbscript: and friends; allow ordinary links.
  if (/^(https?:|mailto:|tel:)/.test(v)) return true;
  // Relative links are fine; anything else with a scheme is not.
  return !/^[a-z][a-z0-9+.-]*:/.test(v);
}

function cleanElement(el: Element) {
  // Strip every attribute except the small set links legitimately need.
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const keep =
      el.tagName === "A" && (name === "href" || name === "target" || name === "rel");
    if (!keep) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (name === "href" && !isSafeHref(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }
  if (el.tagName === "A" && el.getAttribute("target") === "_blank") {
    el.setAttribute("rel", "noopener noreferrer");
  }
}

function walk(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;

    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.parentNode?.removeChild(child);
      continue;
    }

    const el = child as Element;
    const tag = el.tagName.toUpperCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      el.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // Keep the text, discard the wrapper (e.g. <font>, <table>, <img>).
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      continue;
    }

    cleanElement(el);
    walk(el);
  }
}

// The live preview re-renders on every keystroke over a dozen rich-text fields,
// so memoize by input. Bounded to keep long editing sessions from growing it.
const cache = new Map<string, string>();
const CACHE_LIMIT = 200;

/**
 * Return `html` with unsafe markup removed. On the server (no DOM) the input is
 * reduced to plain text, which is safe and renders identically once hydrated.
 */
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }

  const hit = cache.get(html);
  if (hit !== undefined) return hit;

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  walk(doc.body);
  const clean = doc.body.innerHTML;

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(html, clean);
  return clean;
}
