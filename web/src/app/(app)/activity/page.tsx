"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Trash2 } from "lucide-react";
import { ComposeModal } from "@/components/finder/ComposeModal";
import type { CallLogEntry, EmailLogEntry } from "@/lib/db/types";
import type { BusinessResult, MessageTemplate } from "@/types";

interface CalledLeadState {
  called: boolean;
  calledAt: string;
  name: string;
  phone: string;
  email?: string;
  website?: string;
  city: string;
  country: string;
  businessType?: string;
}

export default function ActivityPage() {
  const [tab, setTab] = useState<"emails" | "called" | "audit">("emails");
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [calledLeads, setCalledLeads] = useState<BusinessResult[]>([]);
  const [audit, setAudit] = useState<CallLogEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);

  async function loadEmails(): Promise<EmailLogEntry[]> {
    const res = await fetch("/api/activity?type=emails");
    if (!res.ok) return [];
    return res.json();
  }

  async function load() {
    const [emailRows, callStateRes, auditRes, tplRes] = await Promise.all([
      loadEmails(),
      fetch("/api/call-log"),
      fetch("/api/activity?type=calls"),
      fetch("/api/templates"),
    ]);

    setEmails(emailRows);

    if (callStateRes.ok) {
      const state = (await callStateRes.json()) as Record<string, CalledLeadState>;
      const leads: BusinessResult[] = Object.entries(state)
        .filter(([, v]) => v.called)
        .map(([id, v]) => ({
          id,
          name: v.name,
          address: "",
          phone: v.phone ?? "",
          email: v.email ?? "",
          website: v.website ?? "",
          city: v.city,
          countryName: v.country,
          businessType: v.businessType ?? "hair_salon",
        }));
      setCalledLeads(leads);
    }

    if (auditRes.ok) setAudit(await auditRes.json());
    if (tplRes.ok) setTemplates(await tplRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(type: "emails" | "calls", id: string) {
    await fetch("/api/activity", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    load();
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllCalled() {
    const all = calledLeads.every((l) => selectedIds.has(l.id));
    if (all) setSelectedIds(new Set());
    else setSelectedIds(new Set(calledLeads.map((l) => l.id)));
  }

  const selectedCalled = calledLeads.filter((l) => selectedIds.has(l.id));
  const withEmail = selectedCalled.filter((l) => l.email?.trim()).length;
  const composeCity = selectedCalled[0]?.city ?? "";
  const composeCountry = selectedCalled[0]?.countryName ?? "";
  const composeType = selectedCalled[0]?.businessType ?? "hair_salon";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">Activity</h1>
        <p className="mt-1 text-slate-600">Email sends, called leads, and call audit trail.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["emails", `Emails (${emails.length})`, Mail],
            ["called", `Called leads (${calledLeads.length})`, Phone],
            ["audit", `Call log (${audit.length})`, Phone],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === key ? "bg-indigo-600 text-white" : "bg-white text-slate-600"
            }`}
          >
            <Icon className="mr-2 inline h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "emails" && (
        <div className="space-y-2">
          {emails.length === 0 ? (
            <p className="text-sm text-slate-500">No emails sent yet.</p>
          ) : (
            emails.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur"
              >
                <div>
                  <div className="font-medium text-slate-900">{row.businessName || row.emailAddress}</div>
                  <div className="text-sm text-slate-500">
                    {row.template} · {row.testReal} · {new Date(row.sentAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove("emails", row.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "called" && (
        <div className="space-y-3">
          {calledLeads.length === 0 ? (
            <p className="text-sm text-slate-500">
              No called leads yet. Mark businesses as called in the Finder.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={toggleAllCalled}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {calledLeads.every((l) => selectedIds.has(l.id)) ? "Deselect all" : "Select all"}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Mail className="h-4 w-4" />
                    Send mail ({selectedIds.size})
                    {withEmail < selectedIds.size && (
                      <span className="text-indigo-200">
                        · {withEmail} with email
                      </span>
                    )}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {calledLeads.map((lead) => (
                  <label
                    key={lead.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur hover:bg-indigo-50/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleId(lead.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{lead.name}</div>
                      <div className="text-sm text-slate-500">
                        {lead.phone || "No phone"}
                        {lead.email ? ` · ${lead.email}` : " · No email"}
                        {lead.city ? ` · ${lead.city}` : ""}
                      </div>
                    </div>
                    {!lead.email && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        No email
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-2">
          {audit.length === 0 ? (
            <p className="text-sm text-slate-500">No call activity yet.</p>
          ) : (
            audit.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur"
              >
                <div>
                  <div className="font-medium text-slate-900">{row.businessName}</div>
                  <div className="text-sm text-slate-500">
                    {row.action} · {row.phone} · {new Date(row.calledAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove("calls", row.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {composeOpen && selectedCalled.length > 0 && (
        <ComposeModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          selected={selectedCalled}
          businessType={composeType}
          city={composeCity}
          countryName={composeCountry}
          templates={templates}
          onSent={() => {
            setComposeOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}
