"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import { ResumeData } from "@/lib/resume-types";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: "36 40",
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  // Header
  headerName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 11,
    textAlign: "center",
    color: "#444",
    marginBottom: 4,
  },
  headerContact: {
    fontSize: 9,
    textAlign: "center",
    color: "#555",
    marginBottom: 16,
  },
  link: {
    color: "#333",
    textDecoration: "none",
  },
  // Sections
  sectionHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 3,
  },
  separator: {
    borderBottomWidth: 0.8,
    borderBottomColor: "#1a1a1a",
    marginBottom: 8,
  },
  // Experience / Education
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  entryCompany: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
  },
  entryLocation: {
    fontSize: 9.5,
    color: "#444",
  },
  entryRole: {
    fontSize: 10,
    fontStyle: "italic",
    marginBottom: 2,
  },
  entryDate: {
    fontSize: 9.5,
    color: "#444",
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 8,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
  },
  // Projects
  projectName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
  },
  projectMeta: {
    fontSize: 9,
    color: "#555",
    marginBottom: 2,
  },
  projectDesc: {
    fontSize: 9.5,
    marginBottom: 2,
  },
  // Skills
  skillRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  skillCategory: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    width: 120,
  },
  skillList: {
    flex: 1,
    fontSize: 9.5,
  },
  // Summary
  summary: {
    fontSize: 9.5,
    marginBottom: 4,
  },
  // Achievements / Certs
  achievementText: {
    fontSize: 9.5,
    marginBottom: 2,
    paddingLeft: 8,
  },
  entryBlock: {
    marginBottom: 8,
  },
});

interface Props {
  data: ResumeData;
}

export function WorthyClassicPDF({ data }: Props) {
  const { personal, summary, education, experience, projects, skills, certifications, achievements } = data;

  const contactParts: string[] = [];
  if (personal.email) contactParts.push(personal.email);
  if (personal.phone) contactParts.push(personal.phone);
  if (personal.location) contactParts.push(personal.location);
  if (personal.linkedin) contactParts.push(personal.linkedin);
  if (personal.github) contactParts.push(personal.github);
  if (personal.portfolio) contactParts.push(personal.portfolio);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.headerName}>{personal.fullName || "Your Name"}</Text>
        {personal.title && <Text style={styles.headerTitle}>{personal.title}</Text>}
        {contactParts.length > 0 && (
          <Text style={styles.headerContact}>{contactParts.join("  •  ")}</Text>
        )}

        {/* Summary */}
        {summary && (
          <>
            <Text style={styles.sectionHeader}>Summary</Text>
            <View style={styles.separator} />
            <Text style={styles.summary}>{summary}</Text>
          </>
        )}

        {/* Education */}
        {education.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Education</Text>
            <View style={styles.separator} />
            {education.map((edu) => (
              <View key={edu.id} style={styles.entryBlock}>
                <View style={styles.entryRow}>
                  <Text style={styles.entryCompany}>{edu.institution}</Text>
                  <Text style={styles.entryLocation}>{edu.location}</Text>
                </View>
                <View style={styles.entryRow}>
                  <Text style={styles.entryRole}>
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                  </Text>
                  <Text style={styles.entryDate}>
                    {edu.startDate}{edu.endDate ? ` – ${edu.endDate}` : ""}
                  </Text>
                </View>
                {edu.grade && (
                  <Text style={styles.bulletText}>Grade: {edu.grade}</Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Experience</Text>
            <View style={styles.separator} />
            {experience.map((exp) => (
              <View key={exp.id} style={styles.entryBlock}>
                <View style={styles.entryRow}>
                  <Text style={styles.entryCompany}>{exp.company}</Text>
                  <Text style={styles.entryLocation}>{exp.location}</Text>
                </View>
                <View style={styles.entryRow}>
                  <Text style={styles.entryRole}>{exp.role}</Text>
                  <Text style={styles.entryDate}>
                    {exp.startDate}{exp.endDate ? ` – ${exp.endDate}` : ""}
                  </Text>
                </View>
                {exp.bullets.filter(Boolean).map((b, i) => (
                  <View key={i} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
                {exp.technologies && (
                  <Text style={{ ...styles.bulletText, marginTop: 2, fontStyle: "italic" }}>
                    Technologies: {exp.technologies}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Projects</Text>
            <View style={styles.separator} />
            {projects.map((proj) => (
              <View key={proj.id} style={styles.entryBlock}>
                <View style={styles.entryRow}>
                  <Text style={styles.projectName}>{proj.name}</Text>
                  <Text style={styles.entryDate}>{proj.date}</Text>
                </View>
                {(proj.github || proj.demo) && (
                  <Text style={styles.projectMeta}>
                    {[proj.github && `GitHub: ${proj.github}`, proj.demo && `Demo: ${proj.demo}`].filter(Boolean).join("  •  ")}
                  </Text>
                )}
                {proj.description && <Text style={styles.projectDesc}>{proj.description}</Text>}
                {proj.technologies && (
                  <Text style={{ ...styles.bulletText, fontStyle: "italic" }}>
                    Technologies: {proj.technologies}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Skills</Text>
            <View style={styles.separator} />
            {skills.map((s) => (
              <View key={s.id} style={styles.skillRow}>
                <Text style={styles.skillCategory}>{s.category}:</Text>
                <Text style={styles.skillList}>{s.skills}</Text>
              </View>
            ))}
          </>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Certifications</Text>
            <View style={styles.separator} />
            {certifications.map((c) => (
              <View key={c.id} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  {c.name}{c.issuer ? ` — ${c.issuer}` : ""}{c.date ? ` (${c.date})` : ""}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Achievements</Text>
            <View style={styles.separator} />
            {achievements.map((a) => (
              <View key={a.id} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{a.text}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
