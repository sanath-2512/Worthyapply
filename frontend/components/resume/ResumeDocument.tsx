"use client";

import { ResumeData, normalizeUrl, hasText } from "@/lib/resume-types";
import "./resume-document.css";

interface Props {
  data: ResumeData;
}

/**
 * The single canonical resume renderer.
 * Used for BOTH the live preview and the printed PDF.
 * Rendered as a fixed A4 document (210mm × 297mm).
 */
export function ResumeDocument({ data }: Props) {
  const { personal, summary, education, experience, projects, skills, activities } = data;

  // Header links (label + href)
  const links: { label: string; href: string }[] = [];
  if (personal.linkedin) links.push({ label: "LinkedIn", href: normalizeUrl(personal.linkedin) });
  if (personal.github) links.push({ label: "GitHub", href: normalizeUrl(personal.github) });
  if (personal.codechef) links.push({ label: "CodeChef", href: normalizeUrl(personal.codechef) });
  if (personal.codeforces) links.push({ label: "Codeforces", href: normalizeUrl(personal.codeforces) });
  if (personal.leetcode) links.push({ label: "LeetCode", href: normalizeUrl(personal.leetcode) });
  if (personal.portfolio) links.push({ label: "Portfolio", href: normalizeUrl(personal.portfolio) });

  const { certificates } = data;

  const hasContent =
    personal.fullName || summary || education.length || experience.length ||
    projects.length || certificates.length || skills.length || activities.length;

  return (
    <div className="resume-doc">
      {/* ══ HEADER ══ */}
      <header className="rd-header">
        <h1 className="rd-name">{personal.fullName || "Your Name"}</h1>
        {personal.title && <div className="rd-title">{personal.title}</div>}

        {personal.phone && (
          <div className="rd-contact-line">
            <span className="rd-bold">Phone:</span>{" "}
            <a href={`tel:${personal.phone.replace(/[\s()-]/g, "")}`} className="rd-contact-plain">
              {personal.phone}
            </a>
          </div>
        )}
        {personal.email && (
          <div className="rd-contact-line">
            <span className="rd-bold">Email:</span>{" "}
            <a href={`mailto:${personal.email}`} className="rd-contact-plain">
              {personal.email}
            </a>
          </div>
        )}

        {links.length > 0 && (
          <div className="rd-links-line">
            {links.map((l, i) => (
              <span key={l.label}>
                {i > 0 && <span className="rd-link-sep">·</span>}
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="rd-link">
                  {l.label}
                </a>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* ══ SUMMARY ══ */}
      {hasText(summary) && (
        <section className="rd-section">
          <h2 className="rd-section-title">Professional Summary</h2>
          <div className="rd-rich rd-summary" dangerouslySetInnerHTML={{ __html: summary }} />
        </section>
      )}

      {/* ══ EDUCATION ══ */}
      {education.length > 0 && (
        <section className="rd-section">
          <h2 className="rd-section-title">Education</h2>
          {education.map((edu) => (
            <div key={edu.id} className="rd-entry">
              <div className="rd-entry-row">
                <span className="rd-entry-title">{edu.degree}</span>
                <span className="rd-entry-date">
                  {edu.startDate}{edu.endDate ? ` - ${edu.endDate}` : ""}
                </span>
              </div>
              <div className="rd-entry-row">
                <span className="rd-entry-sub">
                  {edu.institution}{edu.location ? `, ${edu.location}` : ""}
                </span>
                {edu.grade && <span className="rd-entry-meta">{edu.grade}</span>}
              </div>
              {edu.info && <div className="rd-entry-info">{edu.info}</div>}
            </div>
          ))}
        </section>
      )}

      {/* ══ EXPERIENCE ══ */}
      {experience.length > 0 && (
        <section className="rd-section">
          <h2 className="rd-section-title">Internships</h2>
          {experience.map((exp) => (
            <div key={exp.id} className="rd-entry">
              <div className="rd-entry-row">
                <span className="rd-entry-title">{exp.role}</span>
                <span className="rd-entry-date">
                  {exp.startDate}
                  {exp.currentlyWorking ? " - Present" : exp.endDate ? ` - ${exp.endDate}` : ""}
                </span>
              </div>
              <div className="rd-entry-row">
                <span className="rd-entry-sub">{exp.company}</span>
                {exp.location && <span className="rd-entry-meta rd-italic">{exp.location}</span>}
              </div>
              {hasText(exp.description) && (
                <div className="rd-rich" dangerouslySetInnerHTML={{ __html: exp.description }} />
              )}
              {exp.technologies && (
                <div className="rd-tech">
                  <span className="rd-bold">Technologies:</span> {exp.technologies}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ══ PROJECTS ══ */}
      {projects.length > 0 && (
        <section className="rd-section">
          <h2 className="rd-section-title">Projects</h2>
          {projects.map((proj) => (
            <div key={proj.id} className="rd-entry">
              <div className="rd-entry-row">
                <span className="rd-entry-title">
                  {proj.name}
                  {(proj.github || proj.demo) && (
                    <span className="rd-project-links">
                      {" ("}
                      {proj.github && (
                        <a href={normalizeUrl(proj.github)} target="_blank" rel="noopener noreferrer" className="rd-link">GitHub</a>
                      )}
                      {proj.github && proj.demo && <span> · </span>}
                      {proj.demo && (
                        <a href={normalizeUrl(proj.demo)} target="_blank" rel="noopener noreferrer" className="rd-link">Demo</a>
                      )}
                      {")"}
                    </span>
                  )}
                </span>
                <span className="rd-entry-date">
                  {proj.date}{proj.currentlyWorking ? " - Present" : ""}
                </span>
              </div>
              {hasText(proj.description) && (
                <div className="rd-rich" dangerouslySetInnerHTML={{ __html: proj.description }} />
              )}
              {proj.technologies && (
                <div className="rd-tech">
                  <span className="rd-bold">Technologies:</span> {proj.technologies}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ══ CERTIFICATES ══ */}
      {certificates.length > 0 && (
        <section className="rd-section">
          <h2 className="rd-section-title">Certifications</h2>
          {certificates.map((c) => (
            <div key={c.id} className="rd-entry">
              <div className="rd-entry-row">
                <span className="rd-entry-title">
                  {c.title}
                  {c.link && (
                    <span className="rd-project-links">
                      {" ("}
                      <a href={normalizeUrl(c.link)} target="_blank" rel="noopener noreferrer" className="rd-link">Certificate</a>
                      {")"}
                    </span>
                  )}
                </span>
                <span className="rd-entry-date">
                  {c.issueDate}{c.expiryDate ? ` - ${c.expiryDate}` : ""}
                </span>
              </div>
              {c.organisation && (
                <div className="rd-entry-row">
                  <span className="rd-entry-sub">{c.organisation}</span>
                </div>
              )}
              {hasText(c.description) && (
                <div className="rd-rich" dangerouslySetInnerHTML={{ __html: c.description }} />
              )}
            </div>
          ))}
        </section>
      )}

      {/* ══ SKILLS ══ */}
      {skills.length > 0 && (
        <section className="rd-section">
          <h2 className="rd-section-title">Skills</h2>
          {skills.map((sk) => (
            <div key={sk.id} className="rd-skill-row">
              <span className="rd-bold">{sk.category}:</span> {sk.skills}
            </div>
          ))}
        </section>
      )}

      {/* ══ ACTIVITIES ══ */}
      {activities.length > 0 && (
        <section className="rd-section">
          <h2 className="rd-section-title">Extra-Curricular Activities</h2>
          {activities.map((a) => (
            <div key={a.id} className="rd-entry">
              <div className="rd-activity">
                <span className="rd-bold">{a.title}</span>
                {a.organizations && <span> | {a.organizations}</span>}
              </div>
              {hasText(a.description) && (
                <div className="rd-rich" dangerouslySetInnerHTML={{ __html: a.description }} />
              )}
            </div>
          ))}
        </section>
      )}

      {!hasContent && (
        <div className="rd-empty">Start filling in the editor to see your resume here.</div>
      )}

    </div>
  );
}
