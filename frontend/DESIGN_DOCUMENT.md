# WorthyApply — Application Flow & Navigation Design

Scope: **navigation architecture, application flow, browser Back/Forward, and
in-app Back buttons.** Core business logic, the analysis/streaming pipeline, APIs,
data models, and the existing state-machine architecture are preserved. This
supersedes the earlier visual-only notes with a flow-focused design.

---

## 1. Current flow problems (from the actual code)

The main app (`app/page.tsx`) is a **single-page state machine**, not routed:
a `view` React state (`landing → workspace → processing → results`) swaps
components with `AnimatePresence`. The `/builder` route is a separate page, itself
a state machine (`entry → import → builder`).

Concrete problems:

- **No browser history for the main flow.** Moving landing → workspace → results
  never creates history entries. The URL stays `/` the whole time.
- **Browser Back is broken/dangerous on the main flow.** From `results`, Back does
  not go to `workspace`; it exits the site (or does nothing), because those
  transitions were never pushed to history.
- **No in-app Back buttons** on `workspace`, `processing`, or `results`. The only
  way back is the `results` "New" reset, which discards results.
- **Reload always resets to `landing`.** Any in-progress workspace input or results
  are lost silently on refresh (state is in memory only).
- **Cross-route Back loses context.** `results → Generate Tailored Resume` does
  `router.push("/builder")`. Pressing browser Back from `/builder` returns to `/`,
  which re-mounts as `landing` — the user's analysis/results screen is gone.
- **`processing` is a dead-end-ish transient.** If it were a history entry, Back
  would land the user on a spinner with no running job.
- **`/builder` is partially navigable:** import has a Back, screens link home via the
  logo, but the `entry` and `builder` screens lack an explicit, labelled Back to the
  previous context (e.g. back to the analysis you came from).

## 2. Proposed application flow

```
Landing ( / )
  └─ Get Started ─────────────▶ Workspace (upload resume + JD)
                                   └─ Analyze ──▶ Processing (transient) ──▶ Results
                                                                               ├─ Generate Tailored Resume ──▶ /builder (tailored)
                                                                               └─ New ──▶ Workspace (fresh)
Landing ( / )
  └─ Resume Builder (header) ─▶ /builder
                                   ├─ Build from scratch ──▶ Editor
                                   └─ I have a resume ──▶ Import ──▶ Editor
```

Per screen:

| Screen | Entry | Primary action | Secondary | Previous | Exit |
| --- | --- | --- | --- | --- | --- |
| Landing | `/` load | Get Started → Workspace | Resume Builder → /builder | — | — |
| Workspace | Get Started / Back from Results | Analyze → Processing | Back → Landing | Landing | Landing |
| Processing | Analyze (transient) | (auto) → Results / error → Workspace | — | Workspace | Workspace |
| Results | Pipeline done | Generate Tailored Resume → /builder | Back → Workspace; New → fresh Workspace | Workspace | Workspace / /builder |
| Builder entry | /builder | Build / Import | Back → previous (Results or Landing) | Results or Landing | — |
| Builder import | entry | Import → Editor | Back → entry | entry | entry |
| Builder editor | import/scratch/tailored | Edit/Download | Clear → entry; Home → / | entry | / |

## 3. Information architecture

```
WorthyApply
├── / (main app — single-page state machine, history-synced via hash)
│   ├── #landing            (top-level)
│   ├── #workspace          (input)         Back → landing
│   ├── #processing         (transient)     (replaced in history)
│   └── #results            (result)        Back → workspace
└── /builder (route)
    ├── entry               (top-level of builder)   Back → previous context (/ )
    ├── import              Back → entry
    └── builder/editor      Home → /
```

Distinctions:
- **Top-level:** Landing, Builder entry — reachable directly; light/no Back.
- **Input/result:** Workspace, Results — get explicit Back to parent.
- **Transient:** Processing — not a resting destination; replaced in history.
- **Modals/overlays** (builder banners, tailor result panel): UI state, no history entries.

## 4. Navigation rules

- Meaningful main-app screens (`workspace`, `results`) push a history entry via the
  URL hash (`/#workspace`, `/#results`) using the History API.
- `landing` is the base entry (`/`, no hash or `#landing`), established with
  `replaceState` on load.
- `processing` uses `replaceState` (transient): pressing Back from `results` skips the
  spinner and lands on `workspace`.
- A single `popstate` handler maps the current hash back to the `view` state so
  browser Back/Forward drive the UI.
- In-app Back buttons are **history-first with a deterministic parent fallback**:
  they call `history.back()` when the previous entry belongs to our app; otherwise
  they navigate to the logical parent (`landing` for workspace, `workspace` for
  results). This prevents dead-ends on reload/direct-load.
- Back buttons appear only on child/context screens (workspace, results, builder
  import/editor), never as noise on top-level destinations.

## 5. Per-transition table

| Current | Action | Next | History | Visible Back | Back result |
| --- | --- | --- | --- | --- | --- |
| Landing | Get Started | Workspace | push `#workspace` | yes (→ Landing) | Landing |
| Workspace | Analyze | Processing | replace `#processing` | no (transient) | — |
| Processing | pipeline done | Results | push `#results` | no | — |
| Processing | error | Workspace | replace `#workspace` | yes | Landing |
| Results | New | Workspace (fresh) | push `#workspace` | yes | Workspace(prev) |
| Results | Generate Tailored Resume | /builder | route push | in-builder Back | Results |
| Workspace | Back button | Landing | history.back / →landing | — | — |
| Results | Back button | Workspace | history.back / →workspace | — | — |
| Builder entry | Build/Import | Editor/Import | in-state | yes (→ prev/Home) | / |
| Builder import | Back | entry | in-state | — | — |
| Builder editor | Home (logo) | / | route | — | — |

## 6. Browser Back / Forward behavior

- **Back** from Results → Workspace (skips Processing). From Workspace → Landing.
  From `/builder` (opened via tailor) → Results (route history). 
- **Forward** re-applies the hash → restores the corresponding `view`.
- **Reload**: the app reads the current hash on mount and restores the matching
  `view` when the required data still exists; if a screen needs data that only lived
  in memory (e.g. `results` after refresh), it safely falls back to `workspace`
  (never a blank/broken screen).
- We never trap Back or intercept it to block exit; we only add proper entries so it
  behaves naturally.

## 7. Back-button fallback strategy

```
onBack():
  if (window.history.length > 1 && we pushed an entry for this screen)
      history.back()          // real previous screen
  else
      setView(parentOf(current))  // deterministic parent (landing/workspace)
```

## 8. Context preservation

- `results`, `resumeFile`, and `jobDescription` remain in state across Back to
  `workspace`, so returning does not wipe the analysis or the entered JD.
- Builder resume data persists in `localStorage` (unchanged), so builder Back/reload
  keeps work.
- `New` on Results is an explicit fresh-start (clears results) — distinct from Back.

## 9. Accessibility

- Reusable `BackButton` uses the existing inline SVG icon + visible text ("Back",
  or "Back to Workspace"), an `aria-label`, keyboard focus (global `focus-visible`),
  and adequate hit area. Decorative icon is `aria-hidden`.

## 10. Non-goals / preservation
- Not converting the main app into multi-page routing (would rewrite working logic).
- Not changing the pipeline, APIs, schemas, `/builder` internals, or `localStorage`.
- Only the wiring between `view` state and browser history + Back affordances changes.
