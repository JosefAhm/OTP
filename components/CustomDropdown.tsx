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
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setHighlightIndex(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (target && !containerRef.current?.contains(target)) {
        setOpen(false);
        setHighlightIndex(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
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
    <div ref={containerRef} className="custom-dropdown" style={{ position: "relative" }}>
      {/* Hidden input keeps native form behavior */}
      <input type="hidden" name={name} value={value} readOnly />

      <button
        ref={buttonRef}
        type="button"
        className={`input dropdown-trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
      >
        {options.find((o) => o.value === value)?.label ?? "Select..."}
        <span aria-hidden className={`dropdown-arrow${open ? " open" : ""}`} style={{ marginLeft: "0.5rem" }}>
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
                // Use pointer down so selecting the already-selected value still closes the menu
                onPointerDown={(e) => {
                  // Prevent the button's onClick from toggling the menu after selection
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                onClick={(e) => {
                  // Fallback for environments without Pointer Events
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                style={{
                  background: highlighted ? "#e7efff" : "transparent",
                  color: highlighted || selected ? "#1d4ed8" : "#1f2937",
                  fontWeight: selected ? 600 : 500,
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  borderRadius: "0.375rem",
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
