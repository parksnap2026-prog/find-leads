"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Search, X } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { BUSINESS_TYPES } from "@/lib/constants";
import {
  describeSearchScope,
  formatOsmTag,
  getDefaultScopeTags,
  parseOsmTagInput,
  scopeTagsMatchDefaults,
  type OsmTagPair,
} from "@/lib/search-scope";
import { cn } from "@/lib/cn";

export interface SearchFormValues {
  country: string;
  countryName: string;
  city: string;
  businessType: string;
  radius: number;
  scopeTags?: OsmTagPair[];
  /** @deprecated use scopeTags */
  customTags?: OsmTagPair[];
  source?: "auto";
}

interface SearchFormProps {
  loading: boolean;
  onSearch: (values: SearchFormValues) => void;
  onStop?: () => void;
  initialValues?: SearchFormValues | null;
  autoSearch?: boolean;
  stopLabel?: string;
}

function ComboBox({
  label,
  placeholder,
  value,
  displayValue,
  disabled,
  options,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: string;
  displayValue: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onSelect: (value: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(displayValue);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(displayValue);
  }, [displayValue]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options.slice(0, 80);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [options, query]);

  return (
    <div ref={wrapRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-400">No matches</li>
          ) : (
            filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm transition hover:bg-indigo-50",
                    value === opt.value && "bg-indigo-50 font-medium text-indigo-700",
                  )}
                  onClick={() => {
                    onSelect(opt.value, opt.label);
                    setQuery(opt.label);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function SearchForm({
  loading,
  onSearch,
  onStop,
  initialValues,
  autoSearch,
  stopLabel,
}: SearchFormProps) {
  const [country, setCountry] = useState("");
  const [countryName, setCountryName] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [businessType, setBusinessType] = useState("hair_salon");
  const [businessTypeLabel, setBusinessTypeLabel] = useState("Hair Salon");
  const [radius, setRadius] = useState(20000);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeTagInput, setScopeTagInput] = useState("");
  const [scopeTags, setScopeTags] = useState<OsmTagPair[]>(() =>
    getDefaultScopeTags("hair_salon"),
  );
  const [scopeError, setScopeError] = useState<string | null>(null);
  const pendingAutoSearch = useRef<SearchFormValues | null>(null);
  const autoRan = useRef(false);

  const businessTypeOptions = useMemo(
    () =>
      Object.entries(BUSINESS_TYPES).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const scopeCustomized = !scopeTagsMatchDefaults(businessType, scopeTags);

  const countryOptions = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  useEffect(() => {
    if (!country) {
      setCities([]);
      setCity("");
      return;
    }

    let cancelled = false;
    setCitiesLoading(true);
    fetch(`/api/cities/${country}`)
      .then((r) => r.json())
      .then((data: string[] | { error?: string }) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setCities(data);
        } else {
          setCities([]);
        }
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [country]);

  useEffect(() => {
    if (!initialValues) return;
    setCountry(initialValues.country);
    setCountryName(initialValues.countryName);
    setBusinessType(initialValues.businessType);
    setBusinessTypeLabel(
      BUSINESS_TYPES[initialValues.businessType] || initialValues.businessType,
    );
    setRadius(initialValues.radius);
    setScopeTags(
      initialValues.scopeTags ??
        initialValues.customTags ??
        getDefaultScopeTags(initialValues.businessType),
    );
    if (autoSearch) {
      pendingAutoSearch.current = initialValues;
      autoRan.current = false;
    } else {
      setCity(initialValues.city);
    }
  }, [initialValues, autoSearch]);

  useEffect(() => {
    if (!autoSearch || !pendingAutoSearch.current || citiesLoading || autoRan.current) return;
    const pending = pendingAutoSearch.current;
    if (pending.country !== country || !cities.length) return;
    setCity(pending.city);
    autoRan.current = true;
    pendingAutoSearch.current = null;
    onSearch(pending);
  }, [autoSearch, cities, citiesLoading, country, onSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) {
      onStop?.();
      return;
    }
    if (!country || !city) return;
    if (businessType !== "all" && scopeTags.length === 0) {
      setScopeError("Add at least one search rule, or reset to defaults.");
      setScopeOpen(true);
      return;
    }
    setScopeError(null);
    onSearch({ country, countryName, city, businessType, radius, scopeTags });
  }

  function addScopeTag() {
    const parsed = parseOsmTagInput(scopeTagInput);
    if (!parsed) return;
    setScopeTags((prev) => {
      const key = formatOsmTag(parsed);
      if (prev.some((t) => formatOsmTag(t) === key)) return prev;
      return [...prev, parsed];
    });
    setScopeTagInput("");
    setScopeError(null);
  }

  function removeScopeTag(pair: OsmTagPair) {
    setScopeTags((prev) =>
      prev.filter((t) => !(t[0] === pair[0] && t[1] === pair[1])),
    );
  }

  function resetScopeDefaults() {
    setScopeTags(getDefaultScopeTags(businessType));
    setScopeError(null);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl"
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Search businesses</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a location and business type to discover local leads.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ComboBox
          label="Country"
          placeholder="Search countries…"
          value={country}
          displayValue={countryName}
          options={countryOptions}
          onSelect={(code, name) => {
            setCountry(code);
            setCountryName(name);
            setCity("");
          }}
        />

        <ComboBox
          label="City"
          placeholder={country ? "Search cities…" : "Select country first"}
          value={city}
          displayValue={city}
          disabled={!country || citiesLoading}
          options={cities.map((c) => ({ value: c, label: c }))}
          onSelect={(_, name) => setCity(name)}
        />

        <ComboBox
          label="Business type"
          placeholder="Search types… e.g. mechanic, dentist"
          value={businessType}
          displayValue={businessTypeLabel}
          options={businessTypeOptions}
          onSelect={(value, label) => {
            setBusinessType(value);
            setBusinessTypeLabel(label);
            setScopeTags(getDefaultScopeTags(value));
            setScopeError(null);
          }}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Radius</label>
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={20000}>20 km</option>
            <option value={30000}>30 km</option>
          </select>
        </div>
      </div>

      {citiesLoading && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cities…
        </p>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80">
        <button
          type="button"
          onClick={() => setScopeOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-slate-800">Search scope (OSM tags)</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {describeSearchScope(businessType, scopeTags)}
            </p>
          </div>
          {scopeOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          )}
        </button>

        {scopeOpen && (
          <div className="border-t border-slate-200 px-4 pb-4 pt-3">
            <p className="text-xs text-slate-600">
              These rules define what OpenStreetMap places are included. Click{" "}
              <strong>×</strong> on a rule to remove it (e.g. tyre shops for auto repair). Add
              rules below or reset to the defaults for {businessTypeLabel}.
            </p>

            {businessType === "all" && !scopeTags.length && (
              <p className="mt-3 text-xs text-amber-800">
                &quot;All business types&quot; with no rules searches every named shop, amenity,
                office, leisure, tourism &amp; craft in the area. Add rules below to narrow it.
              </p>
            )}

            <div className="mt-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Used when you search ({scopeTags.length} rules)
                </p>
                {scopeCustomized && businessType !== "all" && (
                  <button
                    type="button"
                    onClick={resetScopeDefaults}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Reset defaults
                  </button>
                )}
              </div>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {scopeTags.length ? (
                  scopeTags.map((tag) => (
                    <button
                      key={formatOsmTag(tag)}
                      type="button"
                      onClick={() => removeScopeTag(tag)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-100"
                      title="Remove this rule"
                    >
                      {formatOsmTag(tag)}
                      <X className="h-3 w-3" />
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">
                    No rules — add one below or reset defaults.
                  </span>
                )}
              </div>
              {scopeError && (
                <p className="mt-2 text-xs text-red-600">{scopeError}</p>
              )}
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Add rule
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={scopeTagInput}
                  onChange={(e) => setScopeTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addScopeTag();
                    }
                  }}
                  placeholder="e.g. shop=mechanic"
                  className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={addScopeTag}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={!country || !city}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            loading
              ? "bg-red-500 hover:bg-red-600"
              : "bg-indigo-600 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {loading ? (
            <>
              <X className="h-4 w-4" />
              {stopLabel ?? "Stop search"}
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Search
            </>
          )}
        </button>
      </div>
    </form>
  );
}
