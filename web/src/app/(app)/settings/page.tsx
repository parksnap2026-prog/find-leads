"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Image, Mail, Save, Send, Server } from "lucide-react";
import { injectLogoForPreview, fetchEmailLogoDataUrl, STATIC_EMAIL_LOGO_URL } from "@/lib/logo-preview";

interface TemplateOption {
  id: string;
  label: string;
}

export default function SettingsPage() {
  const [mail, setMail] = useState({
    server: "",
    port: 465,
    user: "",
    pass: "",
    fromName: "",
  });
  const [contactHint, setContactHint] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLogo, setHasLogo] = useState(false);
  const [logoThumbUrl, setLogoThumbUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [testTemplateId, setTestTemplateId] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function loadLogo() {
    setHasLogo(true);
    setLogoThumbUrl(STATIC_EMAIL_LOGO_URL);
    const dataUrl = await fetchEmailLogoDataUrl();
    setLogoDataUrl(dataUrl);
  }

  useEffect(() => {
    fetch("/api/mail-settings")
      .then((r) => r.json())
      .then((data) => {
        const contact = data.contact;
        if (contact?.businessName) {
          setContactHint(
            contact.storeUrl
              ? `Using your store "${contact.businessName}" for signature & contact links`
              : `Using "${contact.businessName}" for sender name — add a store in My Store for phone & website links`,
          );
        }
        if (data.configured) {
          setMail({
            server: data.server ?? "",
            port: data.port ?? 465,
            user: data.user ?? "",
            pass: "",
            fromName: data.fromName ?? "",
          });
          setPasswordSaved(Boolean(data.hasPassword));
          setTestRecipient(data.user || data.contact?.email || "");
        } else if (data.defaults) {
          setMail((m) => ({
            ...m,
            user: data.defaults.user ?? "",
            fromName: data.defaults.fromName ?? "",
          }));
          setTestRecipient(data.defaults.user ?? "");
        }
      })
      .catch(() => {});

    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTemplates(list);
        if (list[0]?.id) setTestTemplateId(list[0].id);
      })
      .catch(() => {});

    loadLogo();
  }, []);

  const previewSrcDoc = useMemo(
    () => injectLogoForPreview(previewHtml, logoDataUrl),
    [previewHtml, logoDataUrl],
  );

  const loadPreview = useCallback(async () => {
    if (!testTemplateId) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/mail-settings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: testTemplateId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewSubject(data.subject ?? "");
        setPreviewHtml(data.body ?? "");
      } else {
        setSaved(data.error || "Preview failed");
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [testTemplateId]);

  useEffect(() => {
    if (testTemplateId) loadPreview();
  }, [testTemplateId, loadPreview]);

  async function saveMail(test = false) {
    setLoading(true);
    setSaved("");
    const res = await fetch("/api/mail-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...mail, test, pingTo: mail.user || testRecipient }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      if (test && data.pingSent) {
        setSaved(
          `Connection OK — test email sent to ${data.to}. Check inbox and spam folder.`,
        );
      } else {
        setSaved(test ? "SMTP connection OK — settings saved" : "Mail settings saved");
      }
      setPasswordSaved(true);
      setMail((m) => ({ ...m, pass: "" }));
    } else {
      setSaved(data.error || "Failed to save mail settings");
    }
  }

  async function sendSimpleTest() {
    if (!mail.user && !testRecipient) {
      setSaved("Enter your email first");
      return;
    }
    setLoading(true);
    setSaved("");
    const res = await fetch("/api/mail-settings/send-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...mail,
        mode: "ping",
        to: testRecipient || mail.user,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSaved(`Simple test email sent to ${data.to} — check inbox and spam`);
      setPasswordSaved(true);
      setMail((m) => ({ ...m, pass: "" }));
    } else {
      setSaved(data.error || "Test send failed");
    }
  }

  async function sendTestEmail() {
    if (!testTemplateId) {
      setSaved("Pick a template first");
      return;
    }
    if (!testRecipient) {
      setSaved("Enter where to send the test email");
      return;
    }
    setLoading(true);
    setSaved("");
    const res = await fetch("/api/mail-settings/send-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...mail,
        template_id: testTemplateId,
        to: testRecipient,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSaved(`Template test sent to ${data.to} — check inbox and spam`);
      setPasswordSaved(true);
      setMail((m) => ({ ...m, pass: "" }));
    } else {
      setSaved(data.error || "Test send failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">Settings</h1>
        <p className="mt-1 text-slate-600">Configure your outbound mail and email logo.</p>
      </div>

      <section className="rounded-2xl border border-white/70 bg-white/70 p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-sky-100 p-2 text-[#007BFF]">
            <Image className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Email logo</h2>
            <p className="text-sm text-slate-500">
              Fixed app logo used in all outreach emails (public/email-logo.png in the repo).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <img
            src={logoThumbUrl ?? STATIC_EMAIL_LOGO_URL}
            alt="Email logo"
            className="h-16 w-auto rounded-lg border border-slate-200 bg-white p-2"
          />
          <p className="text-sm text-slate-500">
            To change the logo, replace <code className="text-xs">web/public/email-logo.png</code> and redeploy.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/70 p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Your mail (SMTP)</h2>
            <p className="text-sm text-slate-500">Emails are sent from your own mailbox.</p>
          </div>
        </div>

        {contactHint && (
          <p className="mb-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            {contactHint}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">SMTP server</label>
            <input
              value={mail.server}
              onChange={(e) => setMail({ ...mail, server: e.target.value })}
              placeholder="mail.yourdomain.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Port</label>
            <input
              type="number"
              value={mail.port}
              onChange={(e) => setMail({ ...mail, port: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-slate-500">465 (SSL) or 587 (TLS)</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Your email</label>
            <input
              type="email"
              value={mail.user}
              onChange={(e) => setMail({ ...mail, user: e.target.value })}
              placeholder="you@yourbusiness.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Email password</label>
            <input
              type="password"
              value={mail.pass}
              onChange={(e) => {
                setMail({ ...mail, pass: e.target.value });
                if (e.target.value) setPasswordSaved(false);
              }}
              placeholder={
                passwordSaved && !mail.pass
                  ? "••••••••  saved — type only to change"
                  : "SMTP password"
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            {passwordSaved && !mail.pass && (
              <p className="mt-1 text-xs font-medium text-emerald-600">Password is saved on the server</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Sender name</label>
            <input
              value={mail.fromName}
              onChange={(e) => setMail({ ...mail, fromName: e.target.value })}
              placeholder="Your business name"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Name recipients see in their inbox (e.g. your store name). Filled from My Store when available.
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          <strong>Save</strong> stores your settings.{" "}
          <strong>Test connection &amp; save</strong> checks login and sends a short test email to your mailbox.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => saveMail(false)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save mail settings
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => saveMail(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Server className="h-4 w-4" />
            Test connection & save
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/70 p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-sky-100 p-2 text-sky-600">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Test email preview</h2>
            <p className="text-sm text-slate-500">
              See how your template looks with your store name and contact links, then send a test to your inbox.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Template</label>
            <select
              value={testTemplateId}
              onChange={(e) => setTestTemplateId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Send test to</label>
            <input
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {previewSubject && (
          <p className="mt-4 text-sm font-medium text-slate-800">
            Subject: <span className="font-normal text-slate-600">{previewSubject}</span>
          </p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {previewLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              Loading preview…
            </div>
          ) : previewSrcDoc ? (
            <iframe
              title="Email preview"
              srcDoc={previewSrcDoc}
              className="h-[420px] w-full border-0"
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              Pick a template to preview
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={sendSimpleTest}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send simple test email
          </button>
          <button
            type="button"
            disabled={loading || previewLoading}
            onClick={loadPreview}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            Refresh preview
          </button>
          <button
            type="button"
            disabled={loading || !testTemplateId}
            onClick={sendTestEmail}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send test email
          </button>
        </div>
      </section>

      {saved && (
        <p
          className={`text-sm font-medium ${
            saved.includes("Failed") ||
            saved.includes("failed") ||
            saved.includes("error") ||
            saved.includes("required") ||
            saved.includes("Pick")
              ? "text-red-600"
              : "text-emerald-600"
          }`}
        >
          {saved}
        </p>
      )}
    </div>
  );
}
