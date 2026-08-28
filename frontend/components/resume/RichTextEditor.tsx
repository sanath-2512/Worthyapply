"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minRows?: number;
}

/**
 * Reusable rich-text editor.
 * Stores HTML. Supports bold, italic, bullet list, numbered list, link.
 * Used across Summary, Experience, Projects, Certificates, Extra-Curricular.
 */
export function RichTextEditor({ value, onChange, placeholder, minRows = 3 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});

  // Sync external value into the editor (only when it differs, to avoid caret jumps)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const emit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
    updateActive();
  };

  const updateActive = useCallback(() => {
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch {
      // queryCommandState can throw in some contexts
    }
  }, []);

  const insertLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      const normalized = url.startsWith("http") ? url : `https://${url}`;
      exec("createLink", normalized);
    }
  };

  const isEmpty = !value || value === "<br>" || value.replace(/<[^>]*>/g, "").trim() === "";

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Text formatting">
        <ToolbarBtn label="Bold" active={active.bold} onClick={() => exec("bold")}>
          <span style={{ fontWeight: 800 }}>B</span>
        </ToolbarBtn>
        <ToolbarBtn label="Italic" active={active.italic} onClick={() => exec("italic")}>
          <span style={{ fontStyle: "italic" }}>I</span>
        </ToolbarBtn>
        <div className="rte-divider" />
        <ToolbarBtn label="Bulleted list" active={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")}>
          •
        </ToolbarBtn>
        <ToolbarBtn label="Numbered list" active={active.insertOrderedList} onClick={() => exec("insertOrderedList")}>
          <span style={{ fontSize: 10 }}>1.</span>
        </ToolbarBtn>
        <div className="rte-divider" />
        <ToolbarBtn label="Insert link" onClick={insertLink}>
          <span style={{ fontSize: 12 }}>🔗</span>
        </ToolbarBtn>
      </div>

      <div className="rte-wrap">
        <div
          ref={ref}
          className="rte-content"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyUp={updateActive}
          onMouseUp={updateActive}
          onFocus={updateActive}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          style={{ minHeight: `${minRows * 1.5}em` }}
        />
        {isEmpty && placeholder && <div className="rte-placeholder">{placeholder}</div>}
      </div>
    </div>
  );
}

function ToolbarBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="rte-btn"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-active={active ? "true" : "false"}
      // Prevent losing selection when clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
