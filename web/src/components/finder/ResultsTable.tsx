"use client";

import Link from "next/link";
import { ExternalLink, Globe, Loader2, Share2, Store } from "lucide-react";
import { formatWebLink, storePageUrl } from "@/lib/lead-links";
import { socialPlatformLabel } from "@/lib/website-url";
import { formatSentDate, getEmailSentStatus, type EmailSentIndex } from "@/lib/email-sent-status";
import type { BusinessResult } from "@/types";
import { cn } from "@/lib/cn";

interface ResultsTableProps {
  results: BusinessResult[];
  radiusUsed?: number | null;
  loading?: boolean;
  selectedIds: Set<string>;
  calledIds: Set<string>;
  emailSentIndex: EmailSentIndex;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onToggleCalled: (biz: BusinessResult, called: boolean) => void;
}

function EmptyCell() {
  return <span className="text-xs text-slate-300">—</span>;
}

export function ResultsTable({
  results,
  radiusUsed,
  loading,
  selectedIds,
  calledIds,
  emailSentIndex,
  onToggle,
  onToggleAll,
  onToggleCalled,
}: ResultsTableProps) {
  const allSelected = results.length > 0 && results.every((r) => selectedIds.has(r.id));

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/70 p-12 text-center backdrop-blur-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="mt-4 font-medium text-slate-700">Searching local businesses…</p>
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-12 text-center backdrop-blur">
        <Globe className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-4 font-medium text-slate-700">No results yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Run a search to discover businesses in your target area.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow-sm backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-900">
            {results.length.toLocaleString()} businesses found
          </h3>
          {radiusUsed ? (
            <p className="text-sm text-slate-500">
              {(radiusUsed / 1000).toFixed(0)} km search radius
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
          {selectedIds.size} selected
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50/80 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="w-10 px-2 py-2.5">Call</th>
              <th className="w-12 px-2 py-2.5 text-center" title="Real email sent to this business">
                Real
              </th>
              <th className="w-12 px-2 py-2.5 text-center" title="Test email logged for this business">
                Test
              </th>
              <th className="min-w-[140px] px-3 py-2.5">Name</th>
              <th className="min-w-[110px] px-3 py-2.5">Phone</th>
              <th className="min-w-[160px] px-3 py-2.5">Email</th>
              <th className="min-w-[140px] px-3 py-2.5">Link</th>
              <th className="min-w-[120px] px-3 py-2.5">Social</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((biz) => {
              const called = calledIds.has(biz.id);
              const emailStatus = getEmailSentStatus(biz, emailSentIndex);
              const storeHref = biz.storeUrl?.includes("returnTo=")
                ? biz.storeUrl
                : biz.storeUrl
                  ? `${biz.storeUrl}?returnTo=${encodeURIComponent("/finder")}`
                  : "";

              return (
                <tr
                  key={biz.id}
                  className={cn(
                    "align-top transition hover:bg-indigo-50/40",
                    called && "bg-emerald-50/50",
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(biz.id)}
                      onChange={() => onToggle(biz.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={called}
                      onChange={(e) => onToggleCalled(biz, e.target.checked)}
                      title="Mark as called"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {emailStatus.realSentAt ? (
                      <span
                        className="inline-flex flex-col items-center text-[10px] font-semibold text-emerald-700"
                        title={`Real email sent ${new Date(emailStatus.realSentAt).toLocaleString()}`}
                      >
                        <span>✓</span>
                        <span className="font-normal text-emerald-600">
                          {formatSentDate(emailStatus.realSentAt)}
                        </span>
                      </span>
                    ) : (
                      <EmptyCell />
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {emailStatus.testSentAt ? (
                      <span
                        className="inline-flex flex-col items-center text-[10px] font-semibold text-amber-700"
                        title={`Test email logged ${new Date(emailStatus.testSentAt).toLocaleString()}`}
                      >
                        <span>✓</span>
                        <span className="font-normal text-amber-600">
                          {formatSentDate(emailStatus.testSentAt)}
                        </span>
                      </span>
                    ) : (
                      <EmptyCell />
                    )}
                  </td>
                  <td className="max-w-[180px] px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-800" title={biz.name}>
                        {biz.name}
                      </span>
                      {biz.isListing && (
                        <span
                          className="shrink-0 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-bold uppercase text-violet-700"
                          title="MBL Store"
                        >
                          MBL
                        </span>
                      )}
                    </div>
                    {biz.address ? (
                      <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-400" title={biz.address}>
                        {biz.address}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {biz.phone ? (
                      <a
                        href={`tel:${biz.phone}`}
                        className="text-slate-600 hover:text-indigo-600"
                        title={biz.phone}
                      >
                        {biz.phone}
                      </a>
                    ) : (
                      <EmptyCell />
                    )}
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5">
                    {biz.email ? (
                      <a
                        href={`mailto:${biz.email}`}
                        className="block truncate text-slate-600 hover:text-indigo-600"
                        title={biz.email}
                      >
                        {biz.email}
                      </a>
                    ) : (
                      <EmptyCell />
                    )}
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5">
                    <div className="space-y-1">
                      {biz.linkStatus === "finding" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Searching…
                        </span>
                      )}
                      {biz.website ? (
                        <a
                          href={biz.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate font-medium text-emerald-700 hover:text-emerald-900"
                          title={biz.website}
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate underline decoration-emerald-200 underline-offset-2">
                            {formatWebLink(biz.website)}
                          </span>
                        </a>
                      ) : biz.linkStatus === "not_found" ? (
                        <span className="text-[10px] font-medium text-slate-400">Not found</span>
                      ) : biz.linkStatus === "error" ? (
                        <span className="text-[10px] font-medium text-red-500">Search failed</span>
                      ) : null}
                      {biz.isListing && storeHref ? (
                        <Link
                          href={storeHref}
                          className="flex items-center gap-1 truncate text-violet-700 hover:text-violet-900"
                          title={storePageUrl(biz, typeof window !== "undefined" ? window.location.origin : "")}
                        >
                          <Store className="h-3 w-3 shrink-0" />
                          <span className="truncate underline decoration-violet-200 underline-offset-2">
                            Store page
                          </span>
                        </Link>
                      ) : null}
                      {!biz.website &&
                      !(biz.isListing && storeHref) &&
                      biz.linkStatus !== "finding" &&
                      biz.linkStatus !== "not_found" &&
                      biz.linkStatus !== "error" ? (
                        <EmptyCell />
                      ) : null}
                    </div>
                  </td>
                  <td className="max-w-[160px] px-3 py-2.5">
                    {biz.socialStatus === "finding" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-pink-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching…
                      </span>
                    )}
                    {biz.social && biz.socialStatus !== "finding" ? (
                      <div className="space-y-1">
                        <a
                          href={biz.social}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate font-medium text-pink-700 hover:text-pink-900"
                          title={biz.social}
                        >
                          <Share2 className="h-3 w-3 shrink-0" />
                          <span className="truncate underline decoration-pink-200 underline-offset-2">
                            {socialPlatformLabel(biz.social)}
                          </span>
                        </a>
                        {biz.socialStatus === "done" && (
                          <span className="text-[10px] font-medium text-emerald-600">Found</span>
                        )}
                        {biz.socialStatus === "error" && (
                          <span className="text-[10px] font-medium text-red-500">Failed</span>
                        )}
                      </div>
                    ) : biz.socialStatus === "not_found" ? (
                      <span className="text-[10px] font-medium text-slate-400">Not found</span>
                    ) : biz.socialStatus !== "finding" ? (
                      <EmptyCell />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
