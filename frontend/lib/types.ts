export interface JobAnalysis {
  job_title: string;
  company: string;
  experience_required: string;
  technical_skills: string[];
  soft_skills: string[];
  responsibilities: string[];
  nice_to_have: string[];
  keywords: string[];
  summary: string;
}

export interface MatchAnalysis {
  required_skills: string[];
  matching_skills: string[];
  skill_gaps: string[];
  match_score: number;
  recommendation: "Apply" | "Maybe" | "Do Not Apply";
  recommendation_reason: string;
}

export interface BulletImprovement {
  original: string;
  improved: string;
  reason: string;
}

export interface ResumeOptimization {
  overall_assessment: string;
  priority_improvements: string[];
  resume_bullet_improvements: BulletImprovement[];
  keywords_to_include: string[];
  missing_or_weak_requirements: string[];
  warnings: string[];
}

export interface AnalysisResponse {
  job_analysis: JobAnalysis;
  match_analysis: MatchAnalysis;
  resume_optimization: ResumeOptimization;
}
