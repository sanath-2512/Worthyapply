export interface AlternativeSkillGroup {
  options: string[];
  required: boolean;
  note?: string;
}

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
  // Requirement-aware fields (optional for backward compatibility)
  employment_type?: string;
  work_mode?: string;
  job_location?: string;
  required_skills?: string[];
  alternative_skill_groups?: AlternativeSkillGroup[];
  preferred_skills?: string[];
  experience_requirements?: string[];
  education_requirements?: string[];
  other_requirements?: string[];
}

export interface RequirementAssessment {
  requirement: string;
  kind: "required" | "preferred" | "or_group" | "experience" | "education" | "other";
  satisfied: "yes" | "partial" | "no";
  evidence?: string;
  points_awarded?: number;
  max_points?: number;
}

export interface MatchAnalysis {
  required_skills: string[];
  matching_skills: string[];
  skill_gaps: string[];
  match_score: number;
  recommendation: "Apply" | "Maybe" | "Do Not Apply";
  recommendation_reason: string;
  // Explainable scoring (optional for backward compatibility)
  requirement_assessments?: RequirementAssessment[];
  scoring_summary?: string;
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
