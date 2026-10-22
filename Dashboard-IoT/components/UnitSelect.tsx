"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UNIT_CATALOG, UnitOption } from "@/lib/unit-catalog";

interface Props {
  /** Selected unit name, or "" / "None" for no selection. */
  value: string;
  onChange: (unit: UnitOption | null) => void;
  placeholder?: string;
}

/**
 * Searchable, grouped unit picker modeled after the Blynk.Console "Units" dropdown:
 * Category header -> Imperial / Metric subgroup -> unit rows with the symbol on the right.
 */
export default function UnitSelect({ value, onChange, placeholder = "None" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = value !== "" && value !== "None";

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return UNIT_CATALOG;
    return UNIT_CATALOG.map((cat) => {
      const catMatch = cat.category.toLowerCase().includes(q);
      const groups = cat.groups
        .map((g) => ({
          ...g,
          units: catMatch
            ? g.units
            : g.units.filter(
                (u) => u.name.toLowerCase().includes(q) || u.symbol.toLowerCase().includes(q)
              ),
        }))
        .filter((g) => g.units.length > 0);
      return { ...cat, groups };
    }).filter((cat) => cat.groups.length > 0);
  }, [query]);

  const select = (u: UnitOption | null) => {
    onChange(u);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div className="unit-select" ref={wrapRef}>
      <div className={`unit-select-control ${open ? "open" : ""}`} onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
        <input
          ref={inputRef}
          type="text"
          className="unit-select-input"
          value={open ? query : hasValue ? value : ""}
          placeholder={hasValue ? value : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); inputRef.current?.blur(); }
          }}
        />
        <svg className="unit-select-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.5" y2="16.5" />
        </svg>
      </div>

      {open && (
        <div className="unit-select-menu">
          {!query && (
            <div className={`unit-select-item ${!hasValue ? "selected" : ""}`} onMouseDown={(e) => { e.preventDefault(); select(null); }}>
              <span>None</span>
            </div>
          )}

          {filtered.length === 0 && <div className="unit-select-empty">No units found</div>}

          {filtered.map((cat, ci) => (
            <div key={cat.category} className={`unit-select-category ${ci > 0 || !query ? "with-divider" : ""}`}>
              <div className="unit-select-cat-label">{cat.category}</div>
              {cat.groups.map((g, gi) => (
                <div key={g.label ?? gi}>
                  {g.label && <div className="unit-select-sub-label">{g.label}</div>}
                  {g.units.map((u) => (
                    <div
                      key={`${cat.category}-${u.name}`}
                      className={`unit-select-item ${value === u.name ? "selected" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); select(u); }}
                    >
                      <span>{u.name}</span>
                      <span className="unit-select-symbol">{u.symbol}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
