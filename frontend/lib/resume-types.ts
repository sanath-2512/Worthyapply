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

/** Check if rich-text HTML has actual visible content. */
export function hasText(html: string): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

/** Normalize a URL — ensure it has https:// prefix. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}
