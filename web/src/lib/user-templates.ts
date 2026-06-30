import fs from "fs";
import path from "path";
import { userTemplatePath } from "@/lib/db/local";

const DEFAULT_TEMPLATE_ID = "starter_template";
const GLOBAL_TEMPLATES_DIR = path.join(process.cwd(), "data", "templates");

function seedMissingGlobalTemplates(userId: string) {
  if (!fs.existsSync(GLOBAL_TEMPLATES_DIR)) return;
  const dir = templatesDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  for (const fname of fs.readdirSync(GLOBAL_TEMPLATES_DIR)) {
    if (!fname.endsWith(".json")) continue;
    const dest = path.join(dir, fname);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(GLOBAL_TEMPLATES_DIR, fname), dest);
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

const DEFAULT_TEMPLATE: FullTemplate = {
  id: DEFAULT_TEMPLATE_ID,
  label: "Starter Template",
  description: "Simple default template you can customize",
  color: "#6366f1",
  default: {
    subject: "Quick question about {{NAME}} in {{CITY}}",
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Starter Template</title>
</head>
<body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
  <p>Hi <strong>{{NAME}}</strong>,</p>
  <p>I found your business in {{CITY}} and wanted to reach out with a quick idea.</p>
  <p>[Write your value proposition here]</p>
  <p>Best regards,<br />[Your Name]</p>
  <img src="cid:logo_webpower" alt="Logo" width="120" style="margin-top: 16px;" />
</body>
</html>`,
  },
  variants: {},
};

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
  const dir = templatesDir(userId);
  fs.mkdirSync(dir, { recursive: true });
}

export function seedStarterTemplate(userId: string) {
  const dir = templatesDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (existing.length === 0) {
    fs.writeFileSync(
      userTemplatePath(userId, DEFAULT_TEMPLATE_ID),
      JSON.stringify(DEFAULT_TEMPLATE, null, 2),
      "utf-8",
    );
  }
  seedMissingGlobalTemplates(userId);
}

export function loadUserTemplate(userId: string, templateId: string): FullTemplate | null {
  ensureInitialTemplate(userId);
  return readTemplateFile(userTemplatePath(userId, templateId));
}

export function loadUserTemplates(userId: string): FullTemplate[] {
  ensureInitialTemplate(userId);
  seedMissingGlobalTemplates(userId);
  const dir = templatesDir(userId);
  if (!fs.existsSync(dir)) return [];
  const templates: FullTemplate[] = [];
  for (const fname of fs.readdirSync(dir)) {
    if (!fname.endsWith(".json")) continue;
    const tpl = readTemplateFile(path.join(dir, fname));
    if (tpl) templates.push(tpl);
  }
  return templates.sort((a, b) => {
    if (a.id === DEFAULT_TEMPLATE_ID) return -1;
    if (b.id === DEFAULT_TEMPLATE_ID) return 1;
    return a.label.localeCompare(b.label);
  });
}

function normalizeTemplateId(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildTemplateBody(title: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
  <p>Hi <strong>{{NAME}}</strong>,</p>
  <p>I found your business in {{CITY}} and wanted to reach out with a quick idea.</p>
  <p>[Write your value proposition here]</p>
  <p>Best regards,<br />[Your Name]</p>
  <img src="cid:logo_webpower" alt="Logo" width="120" style="margin-top: 16px;" />
</body>
</html>`;
}

export function createUserTemplate(
  userId: string,
  input: { label: string; description?: string; color?: string; subject?: string; body?: string },
) {
  ensureInitialTemplate(userId);
  const label = input.label.trim();
  if (!label) throw new Error("Template label is required");

  const baseId = normalizeTemplateId(label);
  if (!baseId) throw new Error("Template label must include letters or numbers");

  const existing = loadUserTemplates(userId);
  const existingIds = new Set(existing.map((t) => t.id));
  let nextId = baseId;
  let suffix = 2;
  while (existingIds.has(nextId)) {
    nextId = `${baseId}_${suffix}`;
    suffix += 1;
  }

  const created: FullTemplate = {
    id: nextId,
    label,
    description: input.description?.trim() || "Custom template",
    color: input.color?.trim() || "#6366f1",
    default: {
      subject: input.subject?.trim() || "Quick question about {{NAME}} in {{CITY}}",
      body: input.body || buildTemplateBody(label),
    },
    variants: {},
  };

  const outPath = userTemplatePath(userId, created.id);
  fs.writeFileSync(outPath, JSON.stringify(created, null, 2), "utf-8");
  return created;
}

export function duplicateUserTemplate(
  userId: string,
  templateId: string,
  newLabel?: string,
) {
  const source = loadUserTemplate(userId, templateId);
  if (!source) throw new Error("Template not found");
  const copyLabel = newLabel?.trim() || `${source.label} Copy`;
  const created = createUserTemplate(userId, {
    label: copyLabel,
    description: source.description,
    color: source.color,
  });
  const duplicated: FullTemplate = {
    ...created,
    default: { ...source.default },
    variants: source.variants ? structuredClone(source.variants) : {},
  };
  fs.writeFileSync(
    userTemplatePath(userId, duplicated.id),
    JSON.stringify(duplicated, null, 2),
    "utf-8",
  );
  return duplicated;
}

export function deleteUserTemplate(userId: string, templateId: string) {
  const filepath = userTemplatePath(userId, templateId);
  if (!fs.existsSync(filepath)) throw new Error("Template not found");
  fs.unlinkSync(filepath);
  return { ok: true };
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
