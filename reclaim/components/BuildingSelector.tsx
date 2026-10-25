"use client";
import { useEffect, useId, useRef, useState } from "react";
import controls from "./InputControls.module.css";
import { Search, X, Check } from "lucide-react";
import { CampusLocation, campus, searchBuildings } from "../lib/campus";
export default function BuildingSelector({
  value,
  onChange,
  label = "Campus building",
  optional = true,
}: {
  value: string;
  onChange: (building: CampusLocation | null) => void;
  label?: string;
  optional?: boolean;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const selected = campus.locations.find((l) => l.id === value);
  const [query, setQuery] = useState(selected?.name || ""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  const previousName = useRef(selected?.name || "");
  useEffect(() => {
    const previous = previousName.current;
    setQuery((q) => (selected ? selected.name : q === previous ? "" : q));
    previousName.current = selected?.name || "";
  }, [value]);
  const results = searchBuildings(query);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (open && active >= 0)
      list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  function choose(building: CampusLocation) {
    onChange(building);
    setQuery(building.name);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }
  return (
    <div className={`building-selector ${controls.buildingControl}`}>
      <label htmlFor={id}>
        {label}
        {optional && <small>Optional</small>}
      </label>
      <div className={`building-search ${controls.inputWrap}`}>
        <Search size={16} />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            open && active >= 0 ? `${id}-option-${active}` : undefined
          }
          autoComplete="off"
          value={selected && !open ? selected.name : query}
          placeholder="Search campus buildings…"
          onFocus={() => {
            setQuery(selected?.name || query);
            setOpen(true);
          }}
          onBlur={(e) => {
            if (
              !e.currentTarget.parentElement?.parentElement?.contains(
                e.relatedTarget as Node,
              )
            ) {
              setOpen(false);
              setActive(-1);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.max(0, a - 1));
            } else if (open && (e.key === "Home" || e.key === "End")) {
              e.preventDefault();
              setActive(e.key === "Home" ? 0 : results.length - 1);
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (active >= 0 && results[active]) choose(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        {(value || query) && (
          <button
            type="button"
            aria-label="Clear building selection"
            className="icon-button"
            onClick={() => {
              input.current?.focus();
              onChange(null);
              setQuery("");
              setActive(-1);
              setOpen(true);
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label="Campus building suggestions"
          className="building-suggestions"
        >
          {results.length ? (
            results.map((building, index) => (
              <li
                role="option"
                aria-selected={index === active}
                id={`${id}-option-${index}`}
                key={building.id}
                className={index === active ? "highlighted" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(building)}
              >
                <span>
                  {building.name}
                  {building.aliases?.length > 0 &&
                    query &&
                    building.name.toLowerCase().indexOf(query.toLowerCase()) <
                      0 && (
                      <small>
                        {building.aliases.find((a) =>
                          a.toLowerCase().includes(query.toLowerCase()),
                        )}
                      </small>
                    )}
                </span>
                {value === building.id && <Check size={14} />}
              </li>
            ))
          ) : (
            <li className="no-building" role="option" aria-selected="false">
              No buildings match. You can select a map point or leave the
              location unknown.
            </li>
          )}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {open
          ? `${results.length} building suggestions`
          : selected
            ? `${selected.name} selected`
            : "No building selected"}
      </span>
    </div>
  );
}
