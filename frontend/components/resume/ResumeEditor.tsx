"use client";

import { ResumeData, Education, Experience, Project, SkillCategory, Certification, Achievement, generateId } from "@/lib/resume-types";
import { motion } from "framer-motion";
import { useState } from "react";

interface Props {
  data: ResumeData;
  onChange: (data: ResumeData) => void;
  onClear: () => void;
}

export function ResumeEditor({ data, onChange, onClear }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);

  const update = (partial: Partial<ResumeData>) => onChange({ ...data, ...partial });
  const updatePersonal = (partial: Partial<ResumeData["personal"]>) =>
    onChange({ ...data, personal: { ...data.personal, ...partial } });

  return (
    <div className="space-y-8 pb-12">
      {/* Personal */}
      <Section title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Full Name *" value={data.personal.fullName} onChange={(v) => updatePersonal({ fullName: v })} />
          <Input label="Professional Title" value={data.personal.title} onChange={(v) => updatePersonal({ title: v })} />
          <Input label="Email *" value={data.personal.email} onChange={(v) => updatePersonal({ email: v })} type="email" />
          <Input label="Phone" value={data.personal.phone} onChange={(v) => updatePersonal({ phone: v })} />
          <Input label="Location" value={data.personal.location} onChange={(v) => updatePersonal({ location: v })} />
          <Input label="LinkedIn" value={data.personal.linkedin} onChange={(v) => updatePersonal({ linkedin: v })} />
          <Input label="GitHub" value={data.personal.github} onChange={(v) => updatePersonal({ github: v })} />
          <Input label="Portfolio" value={data.personal.portfolio} onChange={(v) => updatePersonal({ portfolio: v })} />
        </div>
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <textarea
          value={data.summary}
          onChange={(e) => update({ summary: e.target.value })}
          placeholder="Brief professional summary..."
          rows={3}
          className="w-full rounded-xl p-3 text-sm border resize-y focus:outline-none focus:border-[var(--accent)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        />
      </Section>

      {/* Education */}
      <Section title="Education" onAdd={() => update({ education: [...data.education, { id: generateId(), institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", grade: "" }] })}>
        {data.education.map((edu, i) => (
          <EntryCard key={edu.id} onRemove={() => update({ education: data.education.filter((_, j) => j !== i) })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Institution" value={edu.institution} onChange={(v) => { const arr = [...data.education]; arr[i] = { ...arr[i], institution: v }; update({ education: arr }); }} />
              <Input label="Degree" value={edu.degree} onChange={(v) => { const arr = [...data.education]; arr[i] = { ...arr[i], degree: v }; update({ education: arr }); }} />
              <Input label="Field" value={edu.field} onChange={(v) => { const arr = [...data.education]; arr[i] = { ...arr[i], field: v }; update({ education: arr }); }} />
              <Input label="Location" value={edu.location} onChange={(v) => { const arr = [...data.education]; arr[i] = { ...arr[i], location: v }; update({ education: arr }); }} />
              <Input label="Start Date" value={edu.startDate} onChange={(v) => { const arr = [...data.education]; arr[i] = { ...arr[i], startDate: v }; update({ education: arr }); }} placeholder="2024" />
              <Input label="End Date" value={edu.endDate} onChange={(v) => { const arr = [...data.education]; arr[i] = { ...arr[i], endDate: v }; update({ education: arr }); }} placeholder="2028" />
              <Input label="Grade / GPA" value={edu.grade} onChange={(v) => { const arr = [...data.education]; arr[i] = { ...arr[i], grade: v }; update({ education: arr }); }} />
            </div>
          </EntryCard>
        ))}
      </Section>

      {/* Experience */}
      <Section title="Experience" onAdd={() => update({ experience: [...data.experience, { id: generateId(), company: "", role: "", location: "", startDate: "", endDate: "", bullets: [""], technologies: "" }] })}>
        {data.experience.map((exp, i) => (
          <EntryCard key={exp.id} onRemove={() => update({ experience: data.experience.filter((_, j) => j !== i) })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Input label="Company" value={exp.company} onChange={(v) => { const arr = [...data.experience]; arr[i] = { ...arr[i], company: v }; update({ experience: arr }); }} />
              <Input label="Role" value={exp.role} onChange={(v) => { const arr = [...data.experience]; arr[i] = { ...arr[i], role: v }; update({ experience: arr }); }} />
              <Input label="Location" value={exp.location} onChange={(v) => { const arr = [...data.experience]; arr[i] = { ...arr[i], location: v }; update({ experience: arr }); }} />
              <Input label="Start Date" value={exp.startDate} onChange={(v) => { const arr = [...data.experience]; arr[i] = { ...arr[i], startDate: v }; update({ experience: arr }); }} />
              <Input label="End Date" value={exp.endDate} onChange={(v) => { const arr = [...data.experience]; arr[i] = { ...arr[i], endDate: v }; update({ experience: arr }); }} placeholder="Present" />
              <Input label="Technologies" value={exp.technologies} onChange={(v) => { const arr = [...data.experience]; arr[i] = { ...arr[i], technologies: v }; update({ experience: arr }); }} placeholder="Python, React, AWS" />
            </div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--text-muted)" }}>Bullet Points</label>
            {exp.bullets.map((b, bi) => (
              <div key={bi} className="flex gap-2 mb-2">
                <input
                  value={b}
                  onChange={(e) => { const arr = [...data.experience]; const bullets = [...arr[i].bullets]; bullets[bi] = e.target.value; arr[i] = { ...arr[i], bullets }; update({ experience: arr }); }}
                  className="flex-1 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-[var(--accent)]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="Achievement or responsibility..."
                />
                <button
                  onClick={() => { const arr = [...data.experience]; const bullets = arr[i].bullets.filter((_, j) => j !== bi); arr[i] = { ...arr[i], bullets: bullets.length ? bullets : [""] }; update({ experience: arr }); }}
                  className="text-xs px-2 rounded-lg" style={{ color: "var(--red)" }}
                >✕</button>
              </div>
            ))}
            <button
              onClick={() => { const arr = [...data.experience]; arr[i] = { ...arr[i], bullets: [...arr[i].bullets, ""] }; update({ experience: arr }); }}
              className="text-[11px] font-medium" style={{ color: "var(--accent)" }}
            >+ Add bullet</button>
          </EntryCard>
        ))}
      </Section>

      {/* Projects */}
      <Section title="Projects" onAdd={() => update({ projects: [...data.projects, { id: generateId(), name: "", description: "", technologies: "", github: "", demo: "", date: "" }] })}>
        {data.projects.map((proj, i) => (
          <EntryCard key={proj.id} onRemove={() => update({ projects: data.projects.filter((_, j) => j !== i) })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Name" value={proj.name} onChange={(v) => { const arr = [...data.projects]; arr[i] = { ...arr[i], name: v }; update({ projects: arr }); }} />
              <Input label="Date" value={proj.date} onChange={(v) => { const arr = [...data.projects]; arr[i] = { ...arr[i], date: v }; update({ projects: arr }); }} placeholder="March 2026" />
              <Input label="GitHub" value={proj.github} onChange={(v) => { const arr = [...data.projects]; arr[i] = { ...arr[i], github: v }; update({ projects: arr }); }} />
              <Input label="Demo" value={proj.demo} onChange={(v) => { const arr = [...data.projects]; arr[i] = { ...arr[i], demo: v }; update({ projects: arr }); }} />
              <Input label="Technologies" value={proj.technologies} onChange={(v) => { const arr = [...data.projects]; arr[i] = { ...arr[i], technologies: v }; update({ projects: arr }); }} className="md:col-span-2" />
            </div>
            <textarea
              value={proj.description}
              onChange={(e) => { const arr = [...data.projects]; arr[i] = { ...arr[i], description: e.target.value }; update({ projects: arr }); }}
              placeholder="Brief description..."
              rows={2}
              className="w-full mt-3 rounded-xl p-3 text-sm border resize-y focus:outline-none focus:border-[var(--accent)]"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </EntryCard>
        ))}
      </Section>

      {/* Skills */}
      <Section title="Skills" onAdd={() => update({ skills: [...data.skills, { id: generateId(), category: "", skills: "" }] })}>
        {data.skills.map((s, i) => (
          <EntryCard key={s.id} onRemove={() => update({ skills: data.skills.filter((_, j) => j !== i) })}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
              <Input label="Category" value={s.category} onChange={(v) => { const arr = [...data.skills]; arr[i] = { ...arr[i], category: v }; update({ skills: arr }); }} placeholder="Languages" />
              <Input label="Skills" value={s.skills} onChange={(v) => { const arr = [...data.skills]; arr[i] = { ...arr[i], skills: v }; update({ skills: arr }); }} placeholder="Python, JavaScript, TypeScript" />
            </div>
          </EntryCard>
        ))}
      </Section>

      {/* Certifications */}
      <Section title="Certifications" onAdd={() => update({ certifications: [...data.certifications, { id: generateId(), name: "", issuer: "", date: "" }] })}>
        {data.certifications.map((c, i) => (
          <EntryCard key={c.id} onRemove={() => update({ certifications: data.certifications.filter((_, j) => j !== i) })}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Name" value={c.name} onChange={(v) => { const arr = [...data.certifications]; arr[i] = { ...arr[i], name: v }; update({ certifications: arr }); }} />
              <Input label="Issuer" value={c.issuer} onChange={(v) => { const arr = [...data.certifications]; arr[i] = { ...arr[i], issuer: v }; update({ certifications: arr }); }} />
              <Input label="Date" value={c.date} onChange={(v) => { const arr = [...data.certifications]; arr[i] = { ...arr[i], date: v }; update({ certifications: arr }); }} />
            </div>
          </EntryCard>
        ))}
      </Section>

      {/* Achievements */}
      <Section title="Achievements" onAdd={() => update({ achievements: [...data.achievements, { id: generateId(), text: "" }] })}>
        {data.achievements.map((a, i) => (
          <EntryCard key={a.id} onRemove={() => update({ achievements: data.achievements.filter((_, j) => j !== i) })}>
            <Input label="Achievement" value={a.text} onChange={(v) => { const arr = [...data.achievements]; arr[i] = { ...arr[i], text: v }; update({ achievements: arr }); }} />
          </EntryCard>
        ))}
      </Section>

      {/* Clear */}
      <div className="pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} className="text-[11px] font-medium" style={{ color: "var(--red)" }}>
            Clear all resume data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: "var(--red)" }}>Are you sure?</span>
            <button onClick={() => { onClear(); setConfirmClear(false); }} className="text-[11px] font-bold px-3 py-1 rounded-lg" style={{ background: "var(--red-dim)", color: "var(--red)" }}>Yes, clear</button>
            <button onClick={() => setConfirmClear(false)} className="text-[11px]" style={{ color: "var(--text-muted)" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Primitives ---

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</h3>
        {onAdd && (
          <button onClick={onAdd} className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
            + Add
          </button>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function EntryCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="p-4 rounded-xl border mb-3" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
      <div className="flex justify-end mb-2">
        <button onClick={onRemove} className="text-[10px] px-2 py-0.5 rounded" style={{ color: "var(--red)", background: "var(--red-dim)" }}>Remove</button>
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, className = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-[var(--accent)]"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
      />
    </div>
  );
}
