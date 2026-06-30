"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import type { BusinessResult, MessageTemplate } from "@/types";

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  selected: BusinessResult[];
  businessType: string;
  city: string;
  countryName: string;
  templates: MessageTemplate[];
  onSent: () => void;
}

export function ComposeModal({
  open,
  onClose,
  selected,
  businessType,
  city,
  countryName,
  templates,
  onSent,
}: ComposeModalProps) {
  const [templateId, setTemplateId] = useState("");
  const [index, setIndex] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [results, setResults] = useState<{ name: string; ok: boolean | null; msg: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/mail-settings")
      .then((r) => r.json())
      .then((data) => {
        const addr = data.user || data.contact?.email || "";
        if (addr) setTestRecipient(addr);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (templates.length && !templateId) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  useEffect(() => {
    if (!open || !selected.length || !templateId) return;
    loadCompose(selected[index]);
  }, [open, index, templateId, selected]);

  async function loadCompose(biz: BusinessResult) {
    setLoading(true);
    const bizCity = biz.city ?? city;
    const bizType = biz.businessType ?? businessType;
    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          name: biz.name,
          business_type: bizType,
          city: bizCity,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubject(data.subject);
        setBody(data.body);
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendAll() {
    setSending(true);
    setResults([]);
    const tpl = templates.find((t) => t.id === templateId);
    const rows: { name: string; ok: boolean | null; msg: string }[] = [];

    if (testMode && !testRecipient) {
      setResults([{ name: "—", ok: false, msg: "Configure SMTP in Settings first (test sends to your from address)" }]);
      setSending(false);
      return;
    }

    for (const biz of selected) {
      const email = biz.email?.trim();
      const bizCity = biz.city ?? city;
      const bizCountry = biz.countryName ?? countryName;
      const bizType = biz.businessType ?? businessType;
      if (!email && !testMode) {
        rows.push({ name: biz.name, ok: null, msg: "skipped — no email (run scrape first)" });
        continue;
      }

      let composed: { subject: string; body: string };
      try {
        const cr = await fetch("/api/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            name: biz.name,
            business_type: bizType,
            city: bizCity,
          }),
        });
        composed = await cr.json();
        if (!cr.ok) throw new Error("compose failed");
      } catch {
        rows.push({ name: biz.name, ok: false, msg: "compose error" });
        continue;
      }

      const fd = new FormData();
      fd.append("to", testMode ? testRecipient : email!);
      fd.append("subject", composed.subject);
      fd.append("body", composed.body);
      fd.append("biz_name", biz.name);
      fd.append("template", tpl?.label ?? templateId);
      fd.append("city", bizCity);
      fd.append("country", bizCountry);
      fd.append("biz_type", bizType);
      fd.append("is_test", testMode ? "true" : "false");

      try {
        const sr = await fetch("/api/send-mail", { method: "POST", body: fd });
        const data = await sr.json();
        rows.push({
          name: biz.name,
          ok: !!data.ok,
          msg: data.ok ? (testMode ? "test logged" : "sent") : data.error || "failed",
        });
      } catch {
        rows.push({ name: biz.name, ok: false, msg: "send error" });
      }
    }

    setResults(rows);
    setSending(false);
    onSent();
  }

  if (!open) return null;

  const withEmail = selected.filter((b) => b.email).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Send outreach</h2>
            <p className="text-sm text-slate-500">
              {selected.length} selected · {withEmail} with email
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                templateId === t.id
                  ? "text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              style={templateId === t.id ? { backgroundColor: t.color } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {selected.length > 1 && (
          <div className="flex items-center justify-between px-6 py-2 text-sm text-slate-500">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              className="disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Preview {index + 1} / {selected.length}: <strong>{selected[index]?.name}</strong>
            </span>
            <button
              type="button"
              disabled={index >= selected.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              className="disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        <div className="space-y-3 px-6 py-4">
          <input
            value={loading ? "Loading…" : subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium"
            placeholder="Subject"
          />
          <textarea
            value={loading ? "Loading template…" : body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 font-mono text-xs"
            placeholder="Email body (HTML)"
          />
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
              Test mode — send personalised previews to your SMTP address
            </span>
            {testMode && testRecipient && (
              <span className="text-xs text-slate-400">Test recipient: {testRecipient}</span>
            )}
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            disabled={sending || !templateId}
            onClick={sendAll}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to all selected ({selected.length})
          </button>
          <p className="text-xs text-slate-500">
            Sends one personalised email per selected business that has an email address.
          </p>
        </div>

        {results.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-auto border-t border-slate-100 px-6 py-3">
            {results.map((r) => (
              <div
                key={r.name}
                className={`text-sm ${
                  r.ok === null ? "text-amber-600" : r.ok ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {r.ok === null ? "–" : r.ok ? "✓" : "✗"} {r.name} — {r.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
