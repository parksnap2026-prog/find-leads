"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Filter, Globe, Mail, Search, Share2, X } from "lucide-react";
import { SearchForm, type SearchFormValues } from "@/components/finder/SearchForm";
import { ResultsTable } from "@/components/finder/ResultsTable";
import { ComposeModal } from "@/components/finder/ComposeModal";
import { BUSINESS_TYPES, MAX_ENRICHMENT_SELECTION } from "@/lib/constants";
import { leadLinkForExport } from "@/lib/lead-links";
import { isSocialMediaUrl } from "@/lib/website-url";
import {
  consumeRerunSearch,
  loadFinderSession,
  saveFinderSession,
} from "@/lib/finder-session";
import { buildEmailSentIndex, getEmailSentStatus, type EmailSentIndex } from "@/lib/email-sent-status";
import type { EmailLogEntry } from "@/lib/db/types";
import type { BusinessResult, MessageTemplate } from "@/types";
import type { OsmTagPair } from "@/lib/search-scope";
import { describeSearchScope } from "@/lib/search-scope";

interface SearchContext {
  country: string;
  countryName: string;
  city: string;
  businessType: string;
  scopeTags?: OsmTagPair[];
}

export function FinderClient() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [radiusUsed, setRadiusUsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  const [emailSentIndex, setEmailSentIndex] = useState<EmailSentIndex>(() =>
    buildEmailSentIndex([]),
  );
  const [filterWebsite, setFilterWebsite] = useState(false);
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [filterSocial, setFilterSocial] = useState(false);
  const [filterPhone, setFilterPhone] = useState(false);
  const [filterEmail, setFilterEmail] = useState(false);
  const [scrapingWebsites, setScrapingWebsites] = useState(false);
  const [checkingSocial, setCheckingSocial] = useState(false);
  const [guessingWebsites, setGuessingWebsites] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<SearchFormValues | null>(null);
  const [autoSearch, setAutoSearch] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const abortRef = { current: null as AbortController | null };
  const actionAbortRef = { current: null as AbortController | null };
  const actionStopRef = { current: false };

  const actionRunning = guessingWebsites || checkingSocial || scrapingWebsites;

  const loadEmailLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?type=emails");
      if (!res.ok) return;
      const logs = (await res.json()) as EmailLogEntry[];
      setEmailSentIndex(buildEmailSentIndex(logs));
    } catch {
      /* ignore */
    }
  }, []);

  const selectedTargets = useCallback(
    (items: BusinessResult[]) => items.filter((r) => selectedIds.has(r.id)),
    [selectedIds],
  );

  useEffect(() => {
    const rerun = consumeRerunSearch();
    if (rerun) {
      setFormInitial(rerun);
      setAutoSearch(true);
      setSessionRestored(true);
    } else {
      const saved = loadFinderSession();
      if (saved?.results?.length) {
        setResults(saved.results);
        setRadiusUsed(saved.radiusUsed);
        setSearchContext(saved.searchContext);
        setSelectedIds(new Set(saved.selectedIds));
        if (saved.formValues) setFormInitial(saved.formValues);
      }
      setSessionRestored(true);
    }

    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {});
    fetch("/api/call-log")
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<string>(Object.keys(data || {}));
        setCalledIds(ids);
      })
      .catch(() => {});
    loadEmailLogs();
  }, [loadEmailLogs]);

  useEffect(() => {
    if (!sessionRestored || !results.length) return;
    saveFinderSession({
      results,
      radiusUsed,
      searchContext,
      formValues: formInitial,
      selectedIds: [...selectedIds],
    });
  }, [sessionRestored, results, radiusUsed, searchContext, formInitial, selectedIds]);

  const rowHasWebsite = (r: BusinessResult) =>
    Boolean(r.website || (r.isListing && r.storeUrl));

  const filteredResults = results.filter((r) => {
    if (filterWebsite && !rowHasWebsite(r)) return false;
    if (filterNoWebsite && rowHasWebsite(r)) return false;
    if (filterSocial && !r.social) return false;
    if (filterPhone && !r.phone) return false;
    if (filterEmail && !r.email) return false;
    return true;
  });

  const actionTargets = useCallback(
    (items: BusinessResult[]) => selectedTargets(items),
    [selectedTargets],
  );

  function beginAction() {
    actionStopRef.current = false;
    actionAbortRef.current?.abort();
    actionAbortRef.current = new AbortController();
    return actionAbortRef.current.signal;
  }

  function stopActiveAction() {
    actionStopRef.current = true;
    actionAbortRef.current?.abort();
    setGuessingWebsites(false);
    setCheckingSocial(false);
    setScrapingWebsites(false);
    setResults((prev) =>
      prev.map((r) => {
        const next = { ...r };
        if (next.linkStatus === "finding") next.linkStatus = "idle";
        if (next.socialStatus === "finding") {
          next.socialStatus = next.social ? "pending" : "idle";
        }
        if (next.scrapeStatus === "scanning") next.scrapeStatus = "skipped";
        return next;
      }),
    );
    setActionMessage("Stopped.");
  }

  const scrapeWebsites = useCallback(async (items: BusinessResult[]) => {
    if (!items.length) {
      setActionMessage("Select one or more rows in the table first.");
      return;
    }

    const withSite = items
      .filter((b) => b.website && !isSocialMediaUrl(b.website) && !b.email)
      .slice(0, MAX_ENRICHMENT_SELECTION);
    if (!withSite.length) {
      setActionMessage("Selected rows have no website to scrape, or already have email.");
      return;
    }

    const signal = beginAction();
    setScrapingWebsites(true);
    setActionMessage(`Finding emails on ${withSite.length} selected website(s)…`);
    setResults((prev) =>
      prev.map((r) =>
        withSite.some((w) => w.id === r.id) ? { ...r, scrapeStatus: "scanning" } : r,
      ),
    );

    try {
      const res = await fetch("/api/scrape/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: withSite.map((b) => b.website) }),
        signal,
      });
      if (actionStopRef.current) return;
      const data = await res.json();

      setResults((prev) =>
        prev.map((r) => {
          if (!r.website || !data[r.website]) return r;
          const scraped = data[r.website];
          return {
            ...r,
            email: r.email || scraped.emails?.[0] || "",
            phone: r.phone || scraped.phones?.[0] || "",
            has_agent: scraped.has_agent,
            platforms: scraped.platforms,
            scrapeStatus: "done",
          };
        }),
      );
      setActionMessage(`Email scrape done for ${withSite.length} selected row(s).`);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setResults((prev) =>
        prev.map((r) =>
          r.scrapeStatus === "scanning" ? { ...r, scrapeStatus: "error" } : r,
        ),
      );
      setActionMessage("Email scrape failed.");
    } finally {
      if (!actionStopRef.current) setScrapingWebsites(false);
    }
  }, []);

  const checkSocialMedia = useCallback(
    async (items: BusinessResult[], city: string, countryName: string) => {
      if (!items.length) {
        setActionMessage("Select one or more rows in the table first.");
        return;
      }

      const targets = items.filter((b) => !b.isListing).slice(0, MAX_ENRICHMENT_SELECTION);
      if (!targets.length) {
        setActionMessage("Selected rows cannot be checked (MBL store listings only).");
        return;
      }

      beginAction();
      setCheckingSocial(true);
      let found = 0;

      for (let i = 0; i < targets.length; i++) {
        if (actionStopRef.current) break;

        const t = targets[i];
        setActionMessage(`Searching social media… ${i + 1} / ${targets.length} (selected)`);
        setResults((prev) =>
          prev.map((r) => (r.id === t.id ? { ...r, socialStatus: "finding" } : r)),
        );

        try {
          const res = await fetch("/api/social/find", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: [
                {
                  id: t.id,
                  name: t.name,
                  city,
                  country: countryName,
                  social: t.social ?? "",
                },
              ],
              scrape: true,
            }),
            signal: actionAbortRef.current?.signal,
          });
          if (actionStopRef.current) break;

          const data = await res.json();
          if (!res.ok) {
            setResults((prev) =>
              prev.map((r) => (r.id === t.id ? { ...r, socialStatus: "error" } : r)),
            );
            continue;
          }

          const socialMap = (data.social ?? {}) as Record<string, string>;
          const scraped = (data.scraped ?? {}) as Record<
            string,
            { emails?: string[]; phones?: string[] }
          >;
          const url = socialMap[t.id];
          if (url) found += 1;

          setResults((prev) =>
            prev.map((r) => {
              if (r.id !== t.id) return r;
              if (!url) return { ...r, socialStatus: "not_found" };
              const scrapeData = scraped[url];
              return {
                ...r,
                social: url,
                email: r.email || scrapeData?.emails?.[0] || "",
                phone: r.phone || scrapeData?.phones?.[0] || "",
                socialStatus: "done",
              };
            }),
          );
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") break;
          setResults((prev) =>
            prev.map((r) => (r.id === t.id ? { ...r, socialStatus: "error" } : r)),
          );
        }

        if (i < targets.length - 1 && !actionStopRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (!actionStopRef.current) {
        setActionMessage(`Social search done — found ${found} of ${targets.length} selected.`);
      }
      setCheckingSocial(false);
    },
    [],
  );

  const enrichMissingWebsites = useCallback(
    async (items: BusinessResult[], city: string, countryName: string) => {
      if (!items.length) {
        setActionMessage("Select one or more rows in the table first.");
        return;
      }

      const missing = items.filter((r) => !r.website && !r.isListing).slice(0, MAX_ENRICHMENT_SELECTION);
      if (!missing.length) {
        setActionMessage("Selected rows already have a website link.");
        return;
      }

      beginAction();
      setGuessingWebsites(true);
      let foundCount = 0;

      for (let i = 0; i < missing.length; i++) {
        if (actionStopRef.current) break;

        const b = missing[i];
        setActionMessage(`Finding websites… ${i + 1} / ${missing.length} (selected)`);
        setResults((prev) =>
          prev.map((r) => (r.id === b.id ? { ...r, linkStatus: "finding" } : r)),
        );

        const query = [b.name, b.address, city, countryName].filter(Boolean).join(", ");
        try {
          const res = await fetch("/api/find-by-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
            signal: actionAbortRef.current?.signal,
          });
          if (actionStopRef.current) break;
          const data = await res.json();

          if (res.ok && data.website && !isSocialMediaUrl(data.website)) {
            foundCount += 1;
            setResults((prev) =>
              prev.map((r) =>
                r.id === b.id
                  ? {
                      ...r,
                      website: data.website,
                      email: r.email || data.email || "",
                      phone: r.phone || data.phone || "",
                      linkStatus: "found",
                      scrapeStatus: "done",
                    }
                  : r,
              ),
            );
          } else {
            setResults((prev) =>
              prev.map((r) => (r.id === b.id ? { ...r, linkStatus: "not_found" } : r)),
            );
          }
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") break;
          setResults((prev) =>
            prev.map((r) => (r.id === b.id ? { ...r, linkStatus: "error" } : r)),
          );
        }

        if (i < missing.length - 1 && !actionStopRef.current) {
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      if (!actionStopRef.current) {
        setActionMessage(`Website search done — found ${foundCount} of ${missing.length} selected.`);
      }
      setGuessingWebsites(false);
    },
    [],
  );

  const saveHistory = useCallback(
    (values: SearchFormValues, count: number) => {
      const label = `${BUSINESS_TYPES[values.businessType] || values.businessType} in ${values.city}, ${values.countryName}`;
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          resultCount: count,
          params: {
            country: values.country,
            countryName: values.countryName,
            city: values.city,
            business_type: values.businessType,
            radius: values.radius,
          },
        }),
      }).catch(() => {});
    },
    [],
  );

  const handleSearch = useCallback(
    async (values: SearchFormValues) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setAutoSearch(false);
      setResults([]);
      setSelectedIds(new Set());
      setSearchContext({
        country: values.country,
        countryName: values.countryName,
        city: values.city,
        businessType: values.businessType,
        scopeTags: values.scopeTags,
      });

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            country: values.country,
            city: values.city,
            business_type: values.businessType,
            radius: values.radius,
            scope_tags: values.scopeTags ?? [],
          }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Search failed");
          return;
        }

        const found: BusinessResult[] = (data.results ?? []).map((r: BusinessResult) => ({
          ...r,
          scrapeStatus: "skipped",
          linkStatus: r.website ? "found" : "idle",
          socialStatus: r.social ? "pending" : "idle",
        }));

        setResults(found);
        setRadiusUsed(data.radius_used ?? null);
        setFormInitial(values);
        saveHistory(values, found.length);
        setActionMessage(
          `Found ${found.length} businesses — ${describeSearchScope(values.businessType, values.scopeTags ?? [])} Use Guess websites or Check social when ready.`,
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [saveHistory],
  );

  function handleStop() {
    if (actionRunning) {
      stopActiveAction();
      return;
    }
    abortRef.current?.abort();
    setLoading(false);
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = filteredResults.every((r) => selectedIds.has(r.id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredResults.map((r) => r.id)));
  }

  async function toggleCalled(biz: BusinessResult, called: boolean) {
    const now = new Date().toISOString();
    setCalledIds((prev) => {
      const next = new Set(prev);
      if (called) next.add(biz.id);
      else next.delete(biz.id);
      return next;
    });
    await fetch("/api/call-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: biz.id,
        name: biz.name,
        called,
        calledAt: now,
        phone: biz.phone,
        email: biz.email,
        website: biz.website,
        city: searchContext?.city ?? "",
        country: searchContext?.countryName ?? "",
        businessType: searchContext?.businessType ?? "",
      }),
    }).catch(() => {});
  }

  function slugExportPart(value: string) {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || "unknown"
    );
  }

  function exportCsvFilename() {
    const type = slugExportPart(searchContext?.businessType || "leads");
    const country = slugExportPart(searchContext?.countryName || searchContext?.country || "country");
    const city = slugExportPart(searchContext?.city || "city");
    return `${type}_${country}_${city}.csv`;
  }

  function exportCsv() {
    const rows = filteredResults.filter((r) => selectedIds.has(r.id));
    const exportRows = rows.length ? rows : filteredResults;
    const origin = window.location.origin;
    const header = ["Name", "Phone", "Email", "Link", "Social", "Called", "Email Real", "Email Test"];
    const lines = [
      header.join(","),
      ...exportRows.map((r) => {
        const emailStatus = getEmailSentStatus(r, emailSentIndex);
        return [
          r.name,
          r.phone,
          r.email,
          leadLinkForExport(r, origin),
          r.social || "",
          calledIds.has(r.id) ? "Yes" : "No",
          emailStatus.realSentAt ? "Yes" : "No",
          emailStatus.testSentAt ? "Yes" : "No",
        ]
          .map((v) => `"${(v || "").replace(/"/g, '""')}"`)
          .join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportCsvFilename();
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedBusinesses = filteredResults.filter((r) => selectedIds.has(r.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">Lead Finder</h1>
        <p className="mt-1 text-slate-600">
          Discover and qualify local businesses in your target market.
        </p>
      </div>

      <SearchForm
        loading={loading || actionRunning}
        onSearch={handleSearch}
        onStop={handleStop}
        initialValues={formInitial}
        autoSearch={autoSearch}
        stopLabel={actionRunning ? "Stop enrichment" : undefined}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {actionMessage}
        </div>
      )}

      {(results.length > 0 || loading) && (
        <div className="space-y-3">
          {selectedIds.size > 0 ? (
            <p className="text-sm text-indigo-700">
              <strong>{selectedIds.size}</strong> row{selectedIds.size === 1 ? "" : "s"} selected —
              Guess websites, Check social, and Find emails run on <strong>selected only</strong>.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Select rows in the table first. Guess websites, Check social, and Find emails only run on
              your selection (max {MAX_ENRICHMENT_SELECTION} at a time) — never the full result list.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {actionRunning && (
              <button
                type="button"
                onClick={stopActiveAction}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                <X className="h-4 w-4" />
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterEmail((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                filterEmail
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Has email
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterWebsite((v) => {
                  const next = !v;
                  if (next) setFilterNoWebsite(false);
                  return next;
                });
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                filterWebsite
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Has website
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterNoWebsite((v) => {
                  const next = !v;
                  if (next) setFilterWebsite(false);
                  return next;
                });
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                filterNoWebsite
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              No website
            </button>
            <button
              type="button"
              onClick={() => setFilterSocial((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                filterSocial
                  ? "border-pink-300 bg-pink-50 text-pink-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Has social
            </button>
            <button
              type="button"
              onClick={() => setFilterPhone((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                filterPhone
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Has phone
            </button>
            <button
              type="button"
              onClick={() =>
                searchContext &&
                enrichMissingWebsites(
                  actionTargets(filteredResults),
                  searchContext.city,
                  searchContext.countryName,
                )
              }
              disabled={!filteredResults.length || guessingWebsites || selectedIds.size === 0}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                guessingWebsites
                  ? "border-indigo-300 bg-indigo-100 text-indigo-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title={selectedIds.size === 0 ? "Select rows first" : undefined}
            >
              <Search className={`h-4 w-4 ${guessingWebsites ? "animate-pulse" : ""}`} />
              {guessingWebsites
                ? "Searching websites…"
                : selectedIds.size > 0
                  ? `Guess websites (${selectedIds.size})`
                  : "Guess websites"}
            </button>
            <button
              type="button"
              onClick={() => scrapeWebsites(actionTargets(filteredResults))}
              disabled={!filteredResults.length || scrapingWebsites || selectedIds.size === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
              title={selectedIds.size === 0 ? "Select rows first" : undefined}
            >
              <Globe className="h-4 w-4" />
              {scrapingWebsites
                ? "Scraping…"
                : selectedIds.size > 0
                  ? `Find emails (${selectedIds.size})`
                  : "Find emails (websites)"}
            </button>
            <button
              type="button"
              onClick={() =>
                searchContext &&
                checkSocialMedia(
                  actionTargets(filteredResults),
                  searchContext.city,
                  searchContext.countryName,
                )
              }
              disabled={!filteredResults.length || checkingSocial || selectedIds.size === 0}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                checkingSocial
                  ? "border-pink-300 bg-pink-100 text-pink-900"
                  : "border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100"
              }`}
              title={selectedIds.size === 0 ? "Select rows first" : undefined}
            >
              <Share2 className={`h-4 w-4 ${checkingSocial ? "animate-pulse" : ""}`} />
              {checkingSocial
                ? "Searching social…"
                : selectedIds.size > 0
                  ? `Check social (${selectedIds.size})`
                  : "Check social media"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filteredResults.length}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Mail className="h-4 w-4" />
                Compose & send ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
      )}

      <ResultsTable
        results={filteredResults}
        radiusUsed={radiusUsed}
        loading={loading}
        selectedIds={selectedIds}
        calledIds={calledIds}
        emailSentIndex={emailSentIndex}
        onToggle={toggleId}
        onToggleAll={toggleAll}
        onToggleCalled={toggleCalled}
      />

      {composeOpen && searchContext && (
        <ComposeModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          selected={selectedBusinesses}
          businessType={searchContext.businessType}
          city={searchContext.city}
          countryName={searchContext.countryName}
          templates={templates}
          onSent={loadEmailLogs}
        />
      )}
    </div>
  );
}
