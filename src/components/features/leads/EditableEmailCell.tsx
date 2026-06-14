"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Pencil } from "lucide-react";

interface EditableEmailCellProps {
  placeId: string;
  email?: string | null;
  contactPageUrl?: string | null;
  disabled?: boolean;
  onSave: (placeId: string, email: string) => void;
}

export function EditableEmailCell({
  placeId,
  email,
  contactPageUrl,
  disabled = false,
  onSave,
}: EditableEmailCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(email ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(email ?? "");
  }, [email]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    if (disabled) return;
    setDraft(email ?? "");
    setEditing(true);
  };

  const cancel = () => {
    setDraft(email ?? "");
    setEditing(false);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (email ?? "").trim()) {
      onSave(placeId, trimmed);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="email"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        disabled={disabled}
        placeholder="name@company.com"
        className="w-full min-w-[160px] text-sm bg-white border border-blue-400 ring-2 ring-blue-100 rounded-lg px-2.5 py-1.5 outline-none"
      />
    );
  }

  if (email) {
    return (
      <button
        type="button"
        onClick={startEditing}
        disabled={disabled}
        title="Click to edit email"
        className="group flex items-center gap-1.5 max-w-[200px] text-left text-sm text-neutral-800 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg px-2 py-1.5 transition disabled:opacity-40"
      >
        <Mail size={14} className="shrink-0 text-blue-500 opacity-70" />
        <span className="truncate">{email}</span>
        <Pencil
          size={12}
          className="shrink-0 text-neutral-400 opacity-0 group-hover:opacity-100 transition"
        />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      {contactPageUrl && (
        <a
          href={contactPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 hover:underline text-xs"
          title="Contact form detected"
          onClick={(e) => e.stopPropagation()}
        >
          Contact Form
        </a>
      )}
      <button
        type="button"
        onClick={startEditing}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-neutral-200 hover:border-blue-200 rounded-lg px-2 py-1.5 transition disabled:opacity-40"
      >
        <Pencil size={13} />
        {contactPageUrl ? "Add email" : "Click to add email"}
      </button>
    </div>
  );
}
