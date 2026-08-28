"use client";

import { useState } from "react";
import {
  ResumeData, generateId,
} from "@/lib/resume-types";
import { RichTextEditor } from "./RichTextEditor";
import "./rich-text.css";

interface Props {
  data: ResumeData;
  onChange: (data: ResumeData) => void;
  onClear: () => void;
}

const PROJECT_CATEGORIES = ["AI/ML", "Core", "Dev", "Robotics"];

export function ResumeEditor({ data, onChange, onClear }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const update = (partial: Partial<ResumeData>) => onChange({ ...data, ...partial });
  const updatePersonal = (partial: Partial<ResumeData["personal"]>) =>
    onChange({ ...data, personal: { ...data.personal, ...partial } });

  function move<T>(arr: T[], from: number, to: number): T[] {
    if (to < 0 || to >= arr.length) return arr;
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  }

  return (
    <div className="space-y-8 pb-16">
      {/* PERSONAL */}
      <Group title="Personal Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Full Name *" value={data.personal.fullName} onChange={(v) => updatePersonal({ fullName: v })} />
          <Field label="Professional Title" value={data.personal.title} onChange={(v) => updatePersonal({ title: v })} />
          <Field label="Phone" value={data.personal.phone} onChange={(v) => updatePersonal({ phone: v })} />
          <Field label="Email *" value={data.personal.email} onChange={(v) => updatePersonal({ email: v })} />
        </div>
      </Group>

      {/* SUMMARY (rich text) */}
      <Group title="Professional Summary">
        <RichTextEditor
          value={data.summary}
          onChange={(html) => update({ summary: html })}
          placeholder="Brief professional summary..."
        />
      </Group>

      {/* SOCIAL LINKS */}
      <Group title="Social Links">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="LinkedIn" value={data.personal.linkedin} onChange={(v) => updatePersonal({ linkedin: v })} placeholder="linkedin.com/in/you" />
          <Field label="GitHub" value={data.personal.github} onChange={(v) => updatePersonal({ github: v })} placeholder="github.com/you" />
          <Field label="CodeChef" value={data.personal.codechef} onChange={(v) => updatePersonal({ codechef: v })} />
          <Field label="Codeforces" value={data.personal.codeforces} onChange={(v) => updatePersonal({ codeforces: v })} />
          <Field label="LeetCode" value={data.personal.leetcode} onChange={(v) => updatePersonal({ leetcode: v })} />
          <Field label="Portfolio" value={data.personal.portfolio} onChange={(v) => updatePersonal({ portfolio: v })} />
        </div>
      </Group>

      {/* EDUCATION */}
      <Group title="Education" onAdd={() => update({ education: [...data.education, { id: generateId(), institution: "", degree: "", location: "", startDate: "", endDate: "", grade: "", info: "" }] })} empty={data.education.length === 0} emptyText="No education added yet.">
        {data.education.map((edu, i) => (
          <Entry key={edu.id} index={i} total={data.education.length}
            onRemove={() => update({ education: data.education.filter((_, j) => j !== i) })}
            onMove={(dir) => update({ education: move(data.education, i, i + dir) })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Degree *" value={edu.degree} onChange={(v) => patchArr(data, "education", i, { degree: v }, update)} />
              <Field label="Institute *" value={edu.institution} onChange={(v) => patchArr(data, "education", i, { institution: v }, update)} />
              <Field label="Location" value={edu.location} onChange={(v) => patchArr(data, "education", i, { location: v }, update)} />
              <Field label="Grade" value={edu.grade} onChange={(v) => patchArr(data, "education", i, { grade: v }, update)} placeholder="Grade: 8.28/10" />
              <Field label="Start *" value={edu.startDate} onChange={(v) => patchArr(data, "education", i, { startDate: v }, update)} placeholder="2024" />
              <Field label="End *" value={edu.endDate} onChange={(v) => patchArr(data, "education", i, { endDate: v }, update)} placeholder="2028" />
              <Field label="Additional Info" value={edu.info} onChange={(v) => patchArr(data, "education", i, { info: v }, update)} className="md:col-span-2" />
            </div>
          </Entry>
        ))}
      </Group>

      {/* EXPERIENCE */}
      <Group title="Work Experience" onAdd={() => update({ experience: [...data.experience, { id: generateId(), role: "", company: "", location: "", startDate: "", endDate: "", currentlyWorking: false, description: "", technologies: "" }] })} empty={data.experience.length === 0} emptyText="No experience added yet.">
        {data.experience.map((exp, i) => (
          <Entry key={exp.id} index={i} total={data.experience.length}
            onRemove={() => update({ experience: data.experience.filter((_, j) => j !== i) })}
            onMove={(dir) => update({ experience: move(data.experience, i, i + dir) })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Field label="Designation *" value={exp.role} onChange={(v) => patchArr(data, "experience", i, { role: v }, update)} />
              <Field label="Company *" value={exp.company} onChange={(v) => patchArr(data, "experience", i, { company: v }, update)} />
              <Field label="Location" value={exp.location} onChange={(v) => patchArr(data, "experience", i, { location: v }, update)} />
              <Field label="Technologies" value={exp.technologies} onChange={(v) => patchArr(data, "experience", i, { technologies: v }, update)} />
              <Field label="Start *" value={exp.startDate} onChange={(v) => patchArr(data, "experience", i, { startDate: v }, update)} />
              <Field label="End" value={exp.endDate} onChange={(v) => patchArr(data, "experience", i, { endDate: v }, update)} placeholder="June 2026" disabled={exp.currentlyWorking} />
            </div>
            <Checkbox label="I currently work here" checked={exp.currentlyWorking} onChange={(c) => patchArr(data, "experience", i, { currentlyWorking: c }, update)} />
            <div className="mt-3">
              <FieldLabel>Description *</FieldLabel>
              <RichTextEditor value={exp.description} onChange={(html) => patchArr(data, "experience", i, { description: html }, update)} placeholder="Describe your role and achievements..." />
            </div>
          </Entry>
        ))}
      </Group>

      {/* PROJECTS */}
      <Group title="Projects" onAdd={() => update({ projects: [...data.projects, { id: generateId(), name: "", category: "", github: "", demo: "", date: "", currentlyWorking: false, description: "", technologies: "" }] })} empty={data.projects.length === 0} emptyText="No projects added yet.">
        {data.projects.map((proj, i) => (
          <Entry key={proj.id} index={i} total={data.projects.length}
            onRemove={() => update({ projects: data.projects.filter((_, j) => j !== i) })}
            onMove={(dir) => update({ projects: move(data.projects, i, i + dir) })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Field label="Title *" value={proj.name} onChange={(v) => patchArr(data, "projects", i, { name: v }, update)} />
              <Field label="Date" value={proj.date} onChange={(v) => patchArr(data, "projects", i, { date: v }, update)} placeholder="March 2026" />
              <Field label="Code URL (GitHub)" value={proj.github} onChange={(v) => patchArr(data, "projects", i, { github: v }, update)} />
              <Field label="Hosted URL (Demo)" value={proj.demo} onChange={(v) => patchArr(data, "projects", i, { demo: v }, update)} />
              <Select label="Category" value={proj.category} options={PROJECT_CATEGORIES} onChange={(v) => patchArr(data, "projects", i, { category: v }, update)} />
              <Field label="Technologies" value={proj.technologies} onChange={(v) => patchArr(data, "projects", i, { technologies: v }, update)} />
            </div>
            <Checkbox label="I am currently working on this project" checked={proj.currentlyWorking} onChange={(c) => patchArr(data, "projects", i, { currentlyWorking: c }, update)} />
            <div className="mt-3">
              <FieldLabel>Description</FieldLabel>
              <RichTextEditor value={proj.description} onChange={(html) => patchArr(data, "projects", i, { description: html }, update)} placeholder="Describe the project..." />
            </div>
          </Entry>
        ))}
      </Group>

      {/* CERTIFICATES */}
      <Group title="Certificates" onAdd={() => update({ certificates: [...data.certificates, { id: generateId(), title: "", organisation: "", issueDate: "", expiryDate: "", link: "", description: "" }] })} empty={data.certificates.length === 0} emptyText="No certificates added yet.">
        {data.certificates.map((c, i) => (
          <Entry key={c.id} index={i} total={data.certificates.length}
            onRemove={() => update({ certificates: data.certificates.filter((_, j) => j !== i) })}
            onMove={(dir) => update({ certificates: move(data.certificates, i, i + dir) })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Field label="Certificate Title *" value={c.title} onChange={(v) => patchArr(data, "certificates", i, { title: v }, update)} />
              <Field label="Organisation *" value={c.organisation} onChange={(v) => patchArr(data, "certificates", i, { organisation: v }, update)} />
              <Field label="Issue Date *" value={c.issueDate} onChange={(v) => patchArr(data, "certificates", i, { issueDate: v }, update)} placeholder="March 2025" />
              <Field label="Expiry Date" value={c.expiryDate} onChange={(v) => patchArr(data, "certificates", i, { expiryDate: v }, update)} />
              <Field label="Certification Link" value={c.link} onChange={(v) => patchArr(data, "certificates", i, { link: v }, update)} className="md:col-span-2" />
            </div>
            <FieldLabel>Description</FieldLabel>
            <RichTextEditor value={c.description} onChange={(html) => patchArr(data, "certificates", i, { description: html }, update)} placeholder="Describe the certification..." />
          </Entry>
        ))}
      </Group>

      {/* SKILLS */}
      <Group title="Skills" onAdd={() => update({ skills: [...data.skills, { id: generateId(), category: "", skills: "" }] })} empty={data.skills.length === 0} emptyText="No skill categories yet.">
        {data.skills.map((sk, i) => (
          <Entry key={sk.id} index={i} total={data.skills.length}
            onRemove={() => update({ skills: data.skills.filter((_, j) => j !== i) })}
            onMove={(dir) => update({ skills: move(data.skills, i, i + dir) })}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
              <Field label="Category" value={sk.category} onChange={(v) => patchArr(data, "skills", i, { category: v }, update)} placeholder="Languages" />
              <Field label="Skills" value={sk.skills} onChange={(v) => patchArr(data, "skills", i, { skills: v }, update)} placeholder="Python, JavaScript, TypeScript" />
            </div>
          </Entry>
        ))}
      </Group>

      {/* ACTIVITIES (rich text) */}
      <Group title="Extra-Curricular Activities" onAdd={() => update({ activities: [...data.activities, { id: generateId(), title: "", organizations: "", description: "" }] })} empty={data.activities.length === 0} emptyText="No activities added yet.">
        {data.activities.map((a, i) => (
          <Entry key={a.id} index={i} total={data.activities.length}
            onRemove={() => update({ activities: data.activities.filter((_, j) => j !== i) })}
            onMove={(dir) => update({ activities: move(data.activities, i, i + dir) })}>
            <div className="space-y-3 mb-3">
              <Field label="Title / Category *" value={a.title} onChange={(v) => patchArr(data, "activities", i, { title: v }, update)} />
              <Field label="Organizations / Platforms" value={a.organizations} onChange={(v) => patchArr(data, "activities", i, { organizations: v }, update)} />
            </div>
            <FieldLabel>Description</FieldLabel>
            <RichTextEditor value={a.description} onChange={(html) => patchArr(data, "activities", i, { description: html }, update)} placeholder="Describe the activity..." />
          </Entry>
        ))}
      </Group>

      {/* CLEAR */}
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

function patchArr<K extends keyof ResumeData>(
  data: ResumeData, key: K, index: number, patch: object,
  update: (partial: Partial<ResumeData>) => void
) {
  const arr = [...(data[key] as unknown as object[])];
  arr[index] = { ...arr[index], ...patch };
  update({ [key]: arr } as Partial<ResumeData>);
}

// ─── Primitives ───
function Group({ title, children, onAdd, empty, emptyText }: { title: string; children: React.ReactNode; onAdd?: () => void; empty?: boolean; emptyText?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</h3>
        {onAdd && <button onClick={onAdd} className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>+ Add</button>}
      </div>
      {empty && emptyText ? (
        <div className="text-[12px] rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          {emptyText}
        </div>
      ) : children}
    </div>
  );
}

function Entry({ children, onRemove, onMove, index, total }: { children: React.ReactNode; onRemove: () => void; onMove: (dir: number) => void; index: number; total: number }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="p-4 rounded-xl border mb-3" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-1">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-[11px] px-1.5 disabled:opacity-20" style={{ color: "var(--text-muted)" }} aria-label="Move up">↑</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-[11px] px-1.5 disabled:opacity-20" style={{ color: "var(--text-muted)" }} aria-label="Move down">↓</button>
        </div>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-[10px] px-2 py-0.5 rounded" style={{ color: "var(--red)", background: "var(--red-dim)" }}>Delete</button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: "var(--red)" }}>Delete?</span>
            <button onClick={onRemove} className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "var(--red-dim)", color: "var(--red)" }}>Yes</button>
            <button onClick={() => setConfirming(false)} className="text-[10px]" style={{ color: "var(--text-muted)" }}>No</button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: "var(--text-muted)" }}>{children}</label>;
}

function Field({ label, value, onChange, placeholder, className = "", disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string; disabled?: boolean }) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-[var(--accent)] disabled:opacity-40"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-[var(--accent)]"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: value ? "var(--text)" : "var(--text-muted)" }}
      >
        <option value="">Select...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--accent)]" />
      <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </label>
  );
}
