/**
 * The one heading pattern used by every content section: mono eyebrow, a
 * tight display title, and an optional supporting line. Consistency here is
 * most of what makes long pages feel designed rather than assembled.
 */
interface Props {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "left" | "center";
  size?: "md" | "lg";
  className?: string;
  id?: string;
  as?: "h1" | "h2" | "h3";
  action?: React.ReactNode;
}

export function SectionHeading({ eyebrow, title, sub, align = "left", size = "md", className = "", id, as: Tag = "h2", action }: Props) {
  const center = align === "center";
  return (
    <div className={`${center ? "text-center mx-auto" : ""} ${action ? "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4" : ""} ${className}`}>
      <div className={center ? "mx-auto max-w-2xl" : "max-w-2xl"}>
        {eyebrow && (
          <p className="eyebrow mb-3">
            <span className="w-4 h-px" style={{ background: "currentColor" }} aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <Tag id={id} className={size === "lg" ? "display-md" : "heading"} style={{ color: "var(--text)" }}>
          {title}
        </Tag>
        {sub && (
          <p className={`mt-3 text-[15px] leading-relaxed ${center ? "mx-auto" : ""} max-w-xl`} style={{ color: "var(--text-secondary)" }}>
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
