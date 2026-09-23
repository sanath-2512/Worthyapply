"use client";

import { useId, useState } from "react";
import {
  ResumeData, generateId,
} from "@/lib/resume-types";
import { AnimatePresence, motion } from "framer-motion";
import { RichTextEditor } from "./RichTextEditor";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";

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
    <div className="space-y-5 pb-16">
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
      <div className="pt-6 mt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <AnimatePresence mode="wait" initial={false}>
          {!confirmClear ? (
            <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button variant="ghost" size="sm" iconLeft="trash" onClick={() => setConfirmClear(true)} className="!text-[var(--red)]">
                Clear all resume data
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
              style={{ background: "var(--red-dim)", border: "1px solid var(--red-glow)" }}
              role="alertdialog"
              aria-label="Confirm clearing all resume data"
            >
              <span className="text-[13px] font-medium flex-1 min-w-[160px]" style={{ color: "var(--text)" }}>
                Clear everything? This can&apos;t be undone.
              </span>
              <Button variant="danger" size="xs" onClick={() => { onClear(); setConfirmClear(false); }}>Yes, clear</Button>
              <Button variant="ghost" size="xs" onClick={() => setConfirmClear(false)} autoFocus>Cancel</Button>
            </motion.div>
          )}
        </AnimatePresence>
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
  const count = Array.isArray(children) ? children.length : undefined;
  return (
    <section className="card p-4 sm:p-5" aria-label={title}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] inline-flex items-center gap-2" style={{ color: "var(--text)" }}>
          {title}
          {onAdd && !empty && count !== undefined && (
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)" }}>{count}</span>
          )}
        </h3>
        {onAdd && (
          <Button variant="secondary" size="xs" iconLeft="plus" onClick={onAdd} aria-label={`Add ${title}`}>
            Add
          </Button>
        )}
      </div>
      {empty && emptyText ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full text-[13px] rounded-xl border border-dashed p-5 text-center transition-colors hover:border-[var(--accent)] hover:text-[var(--text-secondary)]"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {emptyText} <span style={{ color: "var(--accent-bright)" }}>Add one</span>
        </button>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function Entry({ children, onRemove, onMove, index, total }: { children: React.ReactNode; onRemove: () => void; onMove: (dir: number) => void; index: number; total: number }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="p-4 rounded-xl border"
      style={{ background: "var(--bg)", borderColor: "var(--border-subtle)" }}
    >
      <div className="flex justify-between items-center mb-3 -mt-1">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono mr-1.5" style={{ color: "var(--text-muted)" }}>#{index + 1}</span>
          <button onClick={() => onMove(-1)} disabled={index === 0} className="icon-btn !min-w-8 !min-h-8 disabled:opacity-25" style={{ color: "var(--text-muted)" }} aria-label="Move up"><Icon name="chevron-up" size={15} /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="icon-btn !min-w-8 !min-h-8 disabled:opacity-25" style={{ color: "var(--text-muted)" }} aria-label="Move down"><Icon name="chevron-down" size={15} /></button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {!confirming ? (
            <motion.button
              key="del"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirming(true)}
              className="icon-btn !min-w-8 !min-h-8"
              style={{ color: "var(--red)" }}
              aria-label="Delete entry"
            >
              <Icon name="trash" size={14} />
            </motion.button>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
              <span className="text-[12px]" style={{ color: "var(--red)" }}>Delete?</span>
              <Button variant="danger" size="xs" onClick={onRemove}>Yes</Button>
              <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>No</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {children}
    </motion.div>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="field-label">{children}</label>;
}

function Field({ label, value, onChange, placeholder, className = "", disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="field h-10 px-3"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field h-10 pl-3 pr-9 appearance-none cursor-pointer"
          style={{ color: value ? "var(--text)" : "var(--text-muted)" }}
        >
          <option value="">Select...</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
          <Icon name="chevron-down" size={14} />
        </span>
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg)]"
        style={{
          background: checked ? "var(--accent)" : "var(--bg-elevated)",
          borderColor: checked ? "var(--accent)" : "var(--border-strong)",
          color: "#fff",
        }}
        aria-hidden="true"
      >
        <span className="transition-transform duration-200" style={{ transform: checked ? "scale(1)" : "scale(0)" }}>
          <Icon name="check" size={12} strokeWidth={3} />
        </span>
      </span>
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </label>
  );
}
