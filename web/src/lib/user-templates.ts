import fs from "fs";
import path from "path";
import { userTemplatePath } from "@/lib/db/local";
import { BUILTIN_TEMPLATE_IDS, BUILTIN_TEMPLATE_ORDER } from "@/lib/templates";

const GLOBAL_TEMPLATES_DIR = path.join(process.cwd(), "data", "templates");

function syncBuiltinTemplates(userId: string) {
  const dir = templatesDir(userId);
  fs.mkdirSync(dir, { recursive: true });

  for (const fname of fs.readdirSync(dir)) {
    if (!fname.endsWith(".json")) continue;
    const id = fname.replace(/\.json$/, "");
    if (!BUILTIN_TEMPLATE_IDS.has(id)) {
      fs.unlinkSync(path.join(dir, fname));
    }
  }

  if (!fs.existsSync(GLOBAL_TEMPLATES_DIR)) return;

  for (const fname of fs.readdirSync(GLOBAL_TEMPLATES_DIR)) {
    if (!fname.endsWith(".json")) continue;
    const id = fname.replace(/\.json$/, "");
    if (!BUILTIN_TEMPLATE_IDS.has(id)) continue;

    const src = path.join(GLOBAL_TEMPLATES_DIR, fname);
    const dest = path.join(dir, fname);
    const shouldCopy =
      !fs.existsSync(dest) ||
      fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs;
    if (shouldCopy) {
      fs.copyFileSync(src, dest);
    }
  }
}

export interface FullTemplate {
  id: string;
  label: string;
  description: string;
  color: string;
  default: { subject: string; body: string };
  variants?: Record<string, { subject: string; body: string }>;
}

function readTemplateFile(filepath: string): FullTemplate | null {
  try {
    if (!fs.existsSync(filepath)) return null;
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as FullTemplate;
  } catch {
    return null;
  }
}

function templatesDir(userId: string) {
  return path.dirname(userTemplatePath(userId, "placeholder"));
}

function ensureInitialTemplate(userId: string) {
  syncBuiltinTemplates(userId);
}

export function seedStarterTemplate(userId: string) {
  ensureInitialTemplate(userId);
}

export function loadUserTemplate(userId: string, templateId: string): FullTemplate | null {
  if (!BUILTIN_TEMPLATE_IDS.has(templateId)) return null;
  ensureInitialTemplate(userId);
  return readTemplateFile(userTemplatePath(userId, templateId));
}

export function loadUserTemplates(userId: string): FullTemplate[] {
  ensureInitialTemplate(userId);
  const templates: FullTemplate[] = [];
  for (const id of BUILTIN_TEMPLATE_ORDER) {
    const tpl = readTemplateFile(userTemplatePath(userId, id));
    if (tpl) templates.push(tpl);
  }
  return templates;
}

export function createUserTemplate() {
  throw new Error("Only built-in templates are available");
}

export function duplicateUserTemplate() {
  throw new Error("Only built-in templates are available");
}

export function deleteUserTemplate() {
  throw new Error("Built-in templates cannot be deleted");
}

export function saveUserTemplate(
  userId: string,
  templateId: string,
  updates: {
    subject?: string;
    body?: string;
    variants?: Record<string, { subject?: string; body?: string }>;
    delete_variant?: string;
  },
) {
  if (!BUILTIN_TEMPLATE_IDS.has(templateId)) {
    throw new Error("Template not found");
  }

  const existing = loadUserTemplate(userId, templateId);
  if (!existing) throw new Error("Template not found");

  const data = structuredClone(existing);
  if (updates.subject !== undefined) {
    data.default.subject = updates.subject;
    data.variants = {};
  }
  if (updates.body !== undefined) {
    data.default.body = updates.body;
    data.variants = {};
  }
  if (updates.variants) {
    data.variants = data.variants ?? {};
    for (const [key, val] of Object.entries(updates.variants)) {
      data.variants[key] = data.variants[key] ?? { subject: "", body: "" };
      if (val.subject !== undefined) data.variants[key].subject = val.subject;
      if (val.body !== undefined) data.variants[key].body = val.body;
    }
  }
  if (updates.delete_variant) {
    delete data.variants?.[updates.delete_variant];
  }

  fs.writeFileSync(
    userTemplatePath(userId, templateId),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
  return data;
}
