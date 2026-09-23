"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { AnalysisResponse } from "@/lib/types";
import { analyzeApplicationStream, ApiError, AgentId, PipelineEvent } from "@/lib/api";
import { Landing } from "@/components/Landing";
import { Workspace } from "@/components/Workspace";
import { Processing, INITIAL_AGENTS, AgentUiState } from "@/components/Processing";
import { Results } from "@/components/Results";
import { SmoothScroll, useSmoothScroll } from "@/components/providers/SmoothScroll";
import { ScrollTrigger } from "@/lib/motion";

type View = "landing" | "workspace" | "processing" | "results";
type LiveText = Partial<Record<string, string>>;

// Map a URL hash to a view (used on load and on browser Back/Forward).
function viewFromHash(hash: string): View {
  const h = hash.replace(/^#/, "");
  if (h === "workspace" || h === "processing" || h === "results") return h;
  return "landing";
}

// Persistence so a page reload restores the current analysis instead of dropping
// the user back to the start. Uses localStorage so it survives reloads (and tab
// close). The typed JD draft is persisted separately by the Workspace component.
const SESSION_KEY = "worthyapply_session_v1";
// Where the user was reading on Results, so returning from the builder (a
// separate route, which remounts this page) lands them back in place.
const RESULTS_SCROLL_KEY = "worthyapply_results_scroll_v1";
const JD_DRAFT_KEY = "worthyapply_jd_draft_v1";

// The backend runs all three analysis phases in ONE call and reports them under
// the single `analyzer` agent, emitting a per-section `agent_output` as each
// phase is parsed. These are the UI steps that one agent drives.
const ANALYSIS_AGENTS: AgentId[] = ["job_analyzer", "matcher", "resume_optimizer"];

interface PersistedSession {
  results: AnalysisResponse | null;
  jobDescription: string;
}

function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    return parsed && parsed.results ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be unavailable (private mode / quota) — non-fatal.
  }
}

function clearSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(JD_DRAFT_KEY);
  } catch {
    // ignore
  }
}

// View transitions: a short blur-through cross-fade. Exits are quicker than
// entrances so the next screen never feels like it is waiting on the last.
const EASE = [0.16, 1, 0.3, 1] as const;
const viewVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  // transitionEnd clears filter/transform: left on the wrapper they would
  // become a containing block and break position:fixed and ScrollTrigger pins.
  enter: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE },
    transitionEnd: { filter: "none", transform: "none" },
  },
  exit: { opacity: 0, y: -8, filter: "blur(6px)", transition: { duration: 0.28, ease: EASE } },
};

export default function Home() {
  return (
    <SmoothScroll>
      <HomeFlow />
    </SmoothScroll>
  );
}

function HomeFlow() {
  // Start with SSR-safe defaults; restore from storage on mount (client only) to
  // avoid hydration mismatches from reading localStorage during render.
  const [view, setView] = useState<View>("landing");
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState<AgentUiState[]>(INITIAL_AGENTS);
  const [liveText, setLiveText] = useState<LiveText>({});
  // Shared status line for the single combined-analysis call.
  const [analysisMessage, setAnalysisMessage] = useState("");
  // Retain the inputs so the Resume Tailoring Agent can reuse them without
  // asking the user to upload the resume or paste the JD again.
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  // After "New" the workspace starts empty; after an error, cancel or Back it
  // is prefilled with the resume the user already chose.
  const [freshWorkspace, setFreshWorkspace] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Latest results, readable synchronously inside the popstate handler.
  const resultsRef = useRef<AnalysisResponse | null>(null);
  // Scroll bookkeeping (presentation only): each new screen starts at the top,
  // except Results reached via browser Back/Forward, which returns to where the
  // user was reading.
  const { scrollTo } = useSmoothScroll();
  const viewRef = useRef<View>("landing");
  const resultsScrollRef = useRef(0);
  const restoreResultsScrollRef = useRef(false);
  // False until the mount effect has resolved the real starting view. Until
  // then the rendered landing is only the server placeholder, and must not play
  // an exit animation if the effect immediately replaces it (e.g. returning to
  // #results): an exit racing the browser's scroll restoration can stall.
  const [booted, setBooted] = useState(false);
  const restoreFromBootRef = useRef(false);

  /**
   * Navigate to a view AND keep browser history in sync.
   * - push: creates a real Back entry (meaningful screens: workspace, results)
   * - replace: swaps the current entry (transient screens: processing, or the
   *   initial landing) so Back skips them.
   * This does not change any business logic; it only mirrors `view` into the URL
   * hash + History API so browser Back/Forward and reload behave predictably.
   */
  const navigate = (next: View, opts: { replace?: boolean } = {}) => {
    rememberScroll();
    restoreResultsScrollRef.current = false;
    setView(next);
    if (typeof window === "undefined") return;
    const url = next === "landing" ? window.location.pathname : `#${next}`;
    if (opts.replace) window.history.replaceState({ view: next }, "", url);
    else window.history.pushState({ view: next }, "", url);
  };

  function rememberScroll() {
    if (viewRef.current !== "results") return;
    resultsScrollRef.current = window.scrollY;
    try { sessionStorage.setItem(RESULTS_SCROLL_KEY, String(window.scrollY)); } catch {}
  }

  // Mount-only (client): restore persisted session + reload-adjusted view, set the
  // base history entry, and restore the view on browser Back/Forward.
  // localStorage and location cannot be read during render without breaking
  // hydration, so the post-mount writes here are deliberate.
  useEffect(() => {
    const restored = loadSession();
    if (restored?.results) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(restored.results);
      if (restored.jobDescription) setJobDescription(restored.jobDescription);
    }

    const fromHash = viewFromHash(window.location.hash);
    let start: View;
    if (fromHash === "results") {
      start = restored?.results ? "results" : "workspace";
    } else if (fromHash === "processing") {
      start = "workspace"; // transient — never restored
    } else {
      start = fromHash; // landing or workspace
    }
    if (start === "results") {
      try {
        resultsScrollRef.current = Number(sessionStorage.getItem(RESULTS_SCROLL_KEY)) || 0;
      } catch {}
      restoreFromBootRef.current = true;
    }
    if (start !== "landing") setView(start);
    setBooted(true);
    window.history.replaceState(
      { view: start },
      "",
      start === "landing" ? window.location.pathname : `#${start}`
    );

    const onPop = (e: PopStateEvent) => {
      const target: View = (e.state && (e.state as { view?: View }).view) || viewFromHash(window.location.hash);
      // results requires data; if absent show workspace.
      if (target === "results" && !resultsRef.current) {
        setView("workspace");
        return;
      }
      rememberScroll();
      restoreResultsScrollRef.current = target === "results";
      // Never restore the transient processing screen via Back/Forward.
      setView(target === "processing" ? "workspace" : target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Keep the Results reading position current. Leaving the route (Open Editor
  // → /builder) unmounts this page after Next has already reset the scroll, so
  // it has to be recorded while the user reads, not on the way out (a trailing
  // scroll event from that reset is why the debounced save is never flushed).
  useEffect(() => {
    if (view !== "results") return;
    const save = () => {
      try { sessionStorage.setItem(RESULTS_SCROLL_KEY, String(window.scrollY)); } catch {}
    };
    let t = 0;
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(save, 150);
    };
    // Leaving for the builder always starts with a click or key press; record
    // the position right then, before the route change resets the scroll.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", save, true);
    window.addEventListener("keydown", save, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", save, true);
      window.removeEventListener("keydown", save, true);
    };
  }, [view]);

  // Restoring straight into Results on mount: no view exit runs, so place the
  // scroll once the results have laid out.
  useEffect(() => {
    if (!booted || view !== "results" || !restoreFromBootRef.current) return;
    restoreFromBootRef.current = false;
    const y = resultsScrollRef.current;
    // Re-measure triggers first: refresh() restores the scroll it recorded,
    // which would undo a jump made before it.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      raf2 = requestAnimationFrame(() => scrollTo(y, { immediate: true }));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [booted, view, scrollTo]);

  // Runs between the old screen leaving and the new one mounting, so the
  // jump is never visible. Triggers are re-measured once the new view is laid out.
  const handleExitComplete = () => {
    // The boot-time swap is placed by the effect above instead.
    if (restoreFromBootRef.current) return;
    const y = restoreResultsScrollRef.current ? resultsScrollRef.current : 0;
    scrollTo(y, { immediate: true });
    restoreResultsScrollRef.current = false;
    requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  const handleGetStarted = () => navigate("workspace");

  const resetAgents = () => {
    setAgents(INITIAL_AGENTS.map((a) => ({ ...a, status: "pending", message: undefined })));
    setLiveText({});
    setAnalysisMessage("");
  };

  const updateAgent = (id: string, patch: Partial<AgentUiState>) =>
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // Apply a patch to every step driven by the combined `analyzer` agent.
  const updateAnalysisAgents = (
    patch: Partial<AgentUiState>,
    only?: (a: AgentUiState) => boolean
  ) =>
    setAgents((prev) =>
      prev.map((a) =>
        ANALYSIS_AGENTS.includes(a.id) && (!only || only(a)) ? { ...a, ...patch } : a
      )
    );

  const handleEvent = (event: PipelineEvent) => {
    switch (event.type) {
      case "agent_started":
        if (event.agent === "analyzer") updateAnalysisAgents({ status: "running", message: undefined });
        else updateAgent(event.agent, { status: "running", message: undefined });
        break;
      case "agent_progress":
        // The analyzer's rotating phase text describes the one in-flight call;
        // show it once for the group rather than repeating it per step.
        if (event.agent === "analyzer") setAnalysisMessage(event.message);
        else updateAgent(event.agent, { status: "running", message: event.message });
        break;
      case "agent_output":
        // A section finished parsing — this is real per-phase completion.
        updateAgent(event.agent, { status: "completed", message: undefined });
        break;
      case "agent_token":
        setLiveText((prev) => ({
          ...prev,
          [event.agent]: (prev[event.agent] || "") + event.text,
        }));
        break;
      case "agent_token_reset":
        // Previous provider failed after streaming cosmetic tokens; clear the
        // partial text so the next provider's stream starts clean.
        setLiveText((prev) => ({ ...prev, [event.agent]: "" }));
        break;
      case "agent_completed":
        if (event.agent === "analyzer") {
          setAnalysisMessage("");
          updateAnalysisAgents({ status: "completed", message: undefined });
        } else {
          updateAgent(event.agent, { status: "completed", message: undefined });
        }
        break;
      case "agent_error":
        if (event.agent === "analyzer") {
          setAnalysisMessage("");
          updateAnalysisAgents(
            { status: "error", message: event.message },
            (a) => a.status !== "completed"
          );
        } else {
          updateAgent(event.agent, { status: "error", message: event.message });
        }
        break;
      // stream_started and pipeline_completed need no UI-state change here.
      default:
        break;
    }
  };

  const handleAnalyze = async (file: File, jd: string) => {
    setFreshWorkspace(false);
    setError("");
    resetAgents();
    setResumeFile(file);
    setJobDescription(jd);
    // Processing is transient: replace so browser Back from Results skips it.
    navigate("processing", { replace: true });

    // Fresh controller so a previous run can't cancel this one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await analyzeApplicationStream(
        file,
        jd,
        handleEvent,
        controller.signal
      );
      setResults(data);
      // Persist so a reload on the results screen restores it instead of resetting.
      saveSession({ results: data, jobDescription: jd });
      // Results is a meaningful destination: push a real Back entry.
      navigate("results");
    } catch (err) {
      if (controller.signal.aborted) return; // user navigated away; stay silent
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      // Return to the input screen (replace the transient processing entry).
      navigate("workspace", { replace: true });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  // Abandon an in-flight analysis and return to the inputs (which are retained).
  const handleCancelAnalysis = () => {
    abortRef.current?.abort();
    resetAgents();
    navigate("workspace", { replace: true });
  };

  // Results "New" — explicit fresh start (distinct from Back).
  const handleReset = () => {
    abortRef.current?.abort();
    setFreshWorkspace(true);
    setResults(null);
    clearSession();
    resetAgents();
    navigate("workspace");
  };

  // In-app Back from Workspace → Landing (history-first fallback target).
  const handleBackToLanding = () => navigate("landing", { replace: true });
  // In-app Back from Results → Workspace (keeps results/inputs in state).
  const handleBackToWorkspace = () => navigate("workspace");

  return (
    <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
      {view === "landing" && (
        <motion.div key="landing" variants={viewVariants} initial="initial" animate="enter" exit={booted ? "exit" : undefined}>
          <Landing onGetStarted={handleGetStarted} />
        </motion.div>
      )}

      {view === "workspace" && (
        <motion.div key="workspace" variants={viewVariants} initial="initial" animate="enter" exit="exit">
          <Workspace
            initialFile={freshWorkspace ? null : resumeFile}
            onAnalyze={handleAnalyze}
            error={error}
            onClearError={() => setError("")}
            onBack={handleBackToLanding}
          />
        </motion.div>
      )}

      {view === "processing" && (
        <motion.div key="processing" variants={viewVariants} initial="initial" animate="enter" exit="exit">
          <Processing
            agents={agents}
            liveText={liveText}
            analysisMessage={analysisMessage}
            onCancel={handleCancelAnalysis}
          />
        </motion.div>
      )}

      {view === "results" && results && (
        <motion.div key="results" variants={viewVariants} initial="initial" animate="enter" exit="exit">
          <Results
            data={results}
            onReset={handleReset}
            onBack={handleBackToWorkspace}
            resumeFile={resumeFile}
            jobDescription={jobDescription}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
