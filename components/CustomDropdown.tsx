"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ExpiryChoice } from "@/lib/constants";

type Option = { value: ExpiryChoice; label: string };

export default function CustomDropdown({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(defaultValue ?? options[0]?.value ?? "");
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (!buttonRef.current) return;
      if (buttonRef.current.contains(e.target as Node)) return;
      if (listRef.current && listRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    if (!open) {
      setHighlightIndex(null);
    }
  }, [open]);

  const toggle = () => setOpen((s) => !s);

  function handleSelect(selected: string) {
    setValue(selected);
    setOpen(false);
    setHighlightIndex(null);
    buttonRef.current?.focus();
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightIndex(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlightIndex(options.length - 1);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i === null ? 0 : Math.min(options.length - 1, i + 1)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i === null ? options.length - 1 : Math.max(0, i - 1)));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex !== null) {
        handleSelect(options[highlightIndex].value);
      }
    }
  }

  return (
    <div className="custom-dropdown" style={{ position: "relative" }}>
      {/* Hidden input keeps native form behavior */}
      <input type="hidden" name={name} value={value} readOnly />

      <button
        ref={buttonRef}
        type="button"
        className="input"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
      >
        {options.find((o) => o.value === value)?.label ?? "Select..."}
        <span aria-hidden style={{ marginLeft: "0.5rem" }}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          ref={listRef}
          className="custom-dropdown-list"
          onKeyDown={onListKeyDown}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            zIndex: 50,
            listStyle: "none",
            padding: 0,
          }}
        >
          {options.map((opt, idx) => {
            const selected = opt.value === value;
            const highlighted = highlightIndex === idx;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={selected}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightIndex(idx)}
                style={{
                  background: highlighted ? "rgb(30, 41, 59)" : "transparent",
                  padding: "0.5rem",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
