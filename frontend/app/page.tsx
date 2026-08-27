"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnalysisResponse } from "@/lib/types";
import { analyzeApplication, ApiError } from "@/lib/api";
import { Landing } from "@/components/Landing";
import { Workspace } from "@/components/Workspace";
import { Processing } from "@/components/Processing";
import { Results } from "@/components/Results";

type View = "landing" | "workspace" | "processing" | "results";

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");

  const handleGetStarted = () => setView("workspace");

  const handleAnalyze = async (file: File, jobDescription: string) => {
    setView("processing");
    setError("");

    try {
      const data = await analyzeApplication(file, jobDescription);
      setResults(data);
      setView("results");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setView("workspace");
    }
  };

  const handleReset = () => {
    setView("workspace");
    setResults(null);
  };

  return (
    <AnimatePresence mode="wait">
      {view === "landing" && (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          <Landing onGetStarted={handleGetStarted} />
        </motion.div>
      )}

      {view === "workspace" && (
        <motion.div
          key="workspace"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4 }}
        >
          <Workspace
            onAnalyze={handleAnalyze}
            error={error}
            onClearError={() => setError("")}
          />
        </motion.div>
      )}

      {view === "processing" && (
        <motion.div
          key="processing"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Processing />
        </motion.div>
      )}

      {view === "results" && results && (
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Results data={results} onReset={handleReset} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
