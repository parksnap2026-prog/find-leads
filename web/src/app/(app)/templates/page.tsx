"use client";

import { useEffect, useState } from "react";
import {
  Code2,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Monitor,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { RichTextEditor } from "@/components/templates/RichTextEditor";
import { injectLogoForPreview, fetchEmailLogoDataUrl } from "@/lib/logo-preview";

interface TemplateMeta {
  id: string;
  label: string;
  description: string;
  color: string;
}

interface FullTemplate extends TemplateMeta {
  default: { subject: string; body: string };
}

type EditMode = "visual" | "raw";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [editing, setEditing] = useState<FullTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editMode, setEditMode] = useState<EditMode>("visual");
  const [showPreview, setShowPreview] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  async function loadLogo() {
    const dataUrl = await fetchEmailLogoDataUrl();
    setLogoDataUrl(dataUrl);
  }

  async function loadTemplates() {
    const res = await fetch("/api/templates");
    if (!res.ok) return;
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadTemplates();
    loadLogo();
  }, []);

  async function openEditor(id: string) {
    const res = await fetch(`/api/templates/${id}`);
    if (!res.ok) return;
    const tpl = await res.json();
    setEditing(tpl);
    setSubject(tpl.default?.subject ?? "");
    setBody(tpl.default?.body ?? "");
    setSaved("");
    setEditMode("visual");
    setShowPreview(true);
  }

  async function saveTemplate() {
    if (!editing) return;
    const res = await fetch(`/api/templates/${editing.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (res.ok) {
      setSaved("Template saved");
      setEditing((e) => (e ? { ...e, default: { ...e.default, subject, body } } : e));
    }
  }

  async function createTemplate() {
    if (!newLabel.trim()) return;
    setCreating(true);
    setSaved("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel, description: newDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaved(data.error || "Failed to create template");
        return;
      }
      setNewLabel("");
      setNewDescription("");
      await loadTemplates();
      await openEditor(data.template.id);
      setSaved("Template created");
    } finally {
      setCreating(false);
    }
  }

  async function duplicateTemplate() {
    if (!editing) return;
    setDuplicating(true);
    setSaved("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duplicateFrom: editing.id,
          label: `${editing.label} Copy`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaved(data.error || "Failed to duplicate");
        return;
      }
      await loadTemplates();
      await openEditor(data.template.id);
      setSaved("Template duplicated");
    } finally {
      setDuplicating(false);
    }
  }

  async function deleteTemplate() {
    if (!editing) return;
    if (!window.confirm(`Delete "${editing.label}"? This cannot be undone.`)) return;
    setDeleting(true);
    setSaved("");
    try {
      const res = await fetch(`/api/templates/${editing.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setSaved(data.error || "Failed to delete");
        return;
      }
      setEditing(null);
      setSubject("");
      setBody("");
      await loadTemplates();
      setSaved("Template deleted");
    } finally {
      setDeleting(false);
    }
  }

  const previewHtml = injectLogoForPreview(body, logoDataUrl);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">Templates</h1>
        <p className="mt-1 text-slate-600">
          Design outreach emails — visual editor, raw HTML, and full preview.
        </p>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <FilePlus2 className="h-5 w-5 text-indigo-600" />
          New template
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Template name"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          type="button"
          disabled={creating || !newLabel.trim()}
          onClick={createTemplate}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <FilePlus2 className="h-4 w-4" />
          {creating ? "Creating…" : "Create template"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/50 p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">No templates yet</p>
            <p className="mt-1 text-sm text-slate-500">Create your first outreach template above.</p>
          </div>
        ) : (
          templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => openEditor(tpl.id)}
              className={`rounded-2xl border p-5 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md ${
                editing?.id === tpl.id
                  ? "border-indigo-300 bg-indigo-50/60 shadow-md"
                  : "border-white/70 bg-white/70"
              }`}
            >
              <div
                className="mb-3 inline-flex rounded-lg p-2"
                style={{ backgroundColor: `${tpl.color}20`, color: tpl.color }}
              >
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900">{tpl.label}</h3>
              <p className="mt-2 text-sm text-slate-600">{tpl.description}</p>
            </button>
          ))
        )}
      </div>

      {editing && (
        <div className="rounded-2xl border border-indigo-200/80 bg-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{editing.label}</h2>
              <p className="text-sm text-slate-500">Edit content, then check the full preview below</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject line</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Quick question about {{NAME}} in {{CITY}}"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Email body</label>
                  <p className="mt-0.5 text-xs text-amber-700">
                    For built-in HTML templates, use <strong>Raw HTML</strong> — the visual editor can break layout.
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setEditMode("visual")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      editMode === "visual"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Type className="h-3.5 w-3.5" />
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode("raw")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      editMode === "raw"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    Raw HTML
                  </button>
                </div>
              </div>

              {editMode === "visual" ? (
                <RichTextEditor
                  key={`${editing.id}-visual`}
                  value={body}
                  onChange={setBody}
                  placeholder="Write your outreach email…"
                />
              ) : (
                <textarea
                  key={`${editing.id}-raw`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck={false}
                  className="min-h-[320px] w-full rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed text-emerald-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="<!DOCTYPE html>…"
                />
              )}
            </div>

            {showPreview && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                  <Monitor className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">Full email preview</span>
                  {!logoDataUrl && (
                    <span className="text-xs text-amber-600">Upload logo in Settings to show it here</span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">
                    Placeholders: {"{{NAME}}"}, {"{{CITY}}"}, {"{{TYPE}}"}
                  </span>
                </div>
                <div className="bg-[#eef2f7] p-4 sm:p-6">
                  {subject && (
                    <div className="mx-auto mb-4 max-w-[640px] rounded-lg bg-white px-4 py-2.5 text-sm shadow-sm">
                      <span className="text-slate-400">Subject: </span>
                      <span className="font-medium text-slate-800">{subject}</span>
                    </div>
                  )}
                  <div className="mx-auto max-w-[640px] overflow-hidden rounded-xl bg-white shadow-md">
                    <iframe
                      title="Email preview"
                      className="h-[min(720px,70vh)] w-full border-0"
                      srcDoc={
                        previewHtml ||
                        "<p style='padding:24px;color:#94a3b8;font-family:sans-serif'>Start writing to see preview…</p>"
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={saveTemplate}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <Save className="h-4 w-4" />
                Save template
              </button>
              <button
                type="button"
                disabled={duplicating}
                onClick={duplicateTemplate}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                {duplicating ? "Duplicating…" : "Duplicate"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={deleteTemplate}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
              {saved && (
                <span className="ml-2 text-sm font-medium text-emerald-600">{saved}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
