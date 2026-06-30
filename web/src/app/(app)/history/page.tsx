"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, RotateCcw } from "lucide-react";
import type { SearchFormValues } from "@/components/finder/SearchForm";
import { queueRerunSearch } from "@/lib/finder-session";
import type { HistoryEntry } from "@/types";

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]));
  }, []);

  function runAgain(entry: HistoryEntry) {
    const values: SearchFormValues = {
      country: entry.params.country,
      countryName: entry.params.countryName ?? entry.params.country,
      city: entry.params.city,
      businessType: entry.params.business_type,
      radius: entry.params.radius ?? 20000,
    };
    queueRerunSearch(values);
    router.push("/finder");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">Search History</h1>
        <p className="mt-1 text-slate-600">
          Re-run any past search with the same parameters in the Finder.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-12 text-center">
          <Clock className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 font-medium text-slate-700">No saved searches yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Run a search in the Finder to build your history.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/70 bg-white/70 px-5 py-4 backdrop-blur"
            >
              <div>
                <div className="font-medium text-slate-900">{entry.label}</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />
                  {entry.params.city}, {entry.params.countryName || entry.params.country}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm text-slate-500">
                  <div>{entry.resultCount} results</div>
                  <div>{new Date(entry.savedAt).toLocaleDateString()}</div>
                </div>
                <button
                  type="button"
                  onClick={() => runAgain(entry)}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Run again
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
