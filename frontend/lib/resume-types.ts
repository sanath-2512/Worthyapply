export interface PersonalInfo {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  grade: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
  technologies: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string;
  github: string;
  demo: string;
  date: string;
}

export interface SkillCategory {
  id: string;
  category: string;
  skills: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface Achievement {
  id: string;
  text: string;
}

export interface ResumeData {
  personal: PersonalInfo;
  summary: string;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: SkillCategory[];
  certifications: Certification[];
  achievements: Achievement[];
}

export function createEmptyResume(): ResumeData {
  return {
    personal: {
      fullName: "",
      title: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
    },
    summary: "",
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: [],
    achievements: [],
  };
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
