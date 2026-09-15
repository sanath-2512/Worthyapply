export interface PersonalInfo {
  fullName: string;
  title: string;
  phone: string;
  email: string;
  linkedin: string;
  github: string;
  codechef: string;
  codeforces: string;
  leetcode: string;
  portfolio: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  location: string;
  startDate: string;
  endDate: string;
  grade: string;
  info: string;
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  description: string; // rich text HTML
  technologies: string;
}

export interface Project {
  id: string;
  name: string;
  category: string;
  github: string;
  demo: string;
  date: string;
  currentlyWorking: boolean;
  description: string; // rich text HTML
  technologies: string;
}

export interface SkillCategory {
  id: string;
  category: string;
  skills: string;
}

export interface Activity {
  id: string;
  title: string;
  organizations: string;
  description: string;
}

export interface Certificate {
  id: string;
  title: string;
  organisation: string;
  issueDate: string;
  expiryDate: string;
  link: string;
  description: string;
}

export interface ResumeData {
  personal: PersonalInfo;
  summary: string;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  certificates: Certificate[];
  skills: SkillCategory[];
  activities: Activity[];
}

export function createEmptyResume(): ResumeData {
  return {
    personal: {
      fullName: "",
      title: "",
      phone: "",
      email: "",
      linkedin: "",
      github: "",
      codechef: "",
      codeforces: "",
      leetcode: "",
      portfolio: "",
    },
    summary: "",
    education: [],
    experience: [],
    projects: [],
    certificates: [],
    skills: [],
    activities: [],
  };
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Merge extracted/partial resume data into a full ResumeData, adding IDs. */
export function mergeExtracted(partial: Partial<ResumeData>): ResumeData {
  const base = createEmptyResume();
  const withId = <T extends object>(items: T[] | undefined): (T & { id: string })[] =>
    (items || []).map((it) => ({ ...it, id: generateId() } as T & { id: string }));

  return {
    personal: { ...base.personal, ...(partial.personal || {}) },
    summary: partial.summary ?? "",
    education: withId(partial.education) as ResumeData["education"],
    experience: withId(partial.experience) as ResumeData["experience"],
    projects: withId(partial.projects) as ResumeData["projects"],
    certificates: withId(partial.certificates) as ResumeData["certificates"],
    skills: withId(partial.skills) as ResumeData["skills"],
    activities: withId(partial.activities) as ResumeData["activities"],
  };
}

/** Check if rich-text HTML has actual visible content. */
export function hasText(html: string): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

/** localStorage keys shared by the builder and the tailoring flow. */
export const RESUME_STORAGE_KEY = "worthyapply_resume_v3";
/** Backup of whatever resume was in the builder before a tailored version replaced it. */
export const RESUME_BACKUP_KEY = "worthyapply_resume_v3_backup";
/** Metadata (source + change summary) for a freshly-tailored resume. */
export const TAILORED_META_KEY = "worthyapply_tailored_meta_v3";

export interface TailoredMeta {
  source: "tailored";
  changes: { section: string; description: string }[];
  addedSkills?: string[];
  message?: string;
  createdAt: number;
}

/**
 * Save a tailored resume into the builder's storage WITHOUT destroying the
 * user's previous resume. Any existing builder resume is copied to a backup
 * key first, so the original remains recoverable.
 */
export function saveTailoredResume(
  tailored: Partial<ResumeData>,
  changes: { section: string; description: string }[],
  addedSkills?: string[],
  message?: string
): void {
  try {
    const existing = localStorage.getItem(RESUME_STORAGE_KEY);
    if (existing) {
      // Preserve the previous resume so it is never destructively lost.
      localStorage.setItem(RESUME_BACKUP_KEY, existing);
    }
    const full = mergeExtracted(tailored);
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(full));
    const meta: TailoredMeta = {
      source: "tailored",
      changes,
      addedSkills: addedSkills || [],
      message: message || "Skills and recommendations were added directly to your resume. If you don't have this in your tech stack, you can remove it here.",
      createdAt: Date.now()
    };
    localStorage.setItem(TAILORED_META_KEY, JSON.stringify(meta));
  } catch {
    // localStorage may be unavailable (private mode / quota). The caller still
    // navigates to the builder; worst case the user re-imports.
  }
}

/** Read the tailored metadata (returns null if none). */
export function readTailoredMeta(): TailoredMeta | null {
  try {
    const raw = localStorage.getItem(TAILORED_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TailoredMeta;
  } catch {
    return null;
  }
}

/**
 * Consume the tailored metadata so the banner does not reappear on every later
 * visit to the builder. The tailored resume itself and its backup are untouched.
 */
export function clearTailoredMeta(): void {
  try {
    localStorage.removeItem(TAILORED_META_KEY);
  } catch {
    // storage unavailable — the banner simply stays for this session
  }
}

/** Restore the pre-tailoring resume backup, if one exists. Returns true on success. */
export function restoreResumeBackup(): boolean {
  try {
    const backup = localStorage.getItem(RESUME_BACKUP_KEY);
    if (!backup) return false;
    localStorage.setItem(RESUME_STORAGE_KEY, backup);
    localStorage.removeItem(TAILORED_META_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Normalize a URL — ensure it has https:// prefix. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}
