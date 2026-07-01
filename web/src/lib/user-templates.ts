import fs from "fs";
import path from "path";
import {
  getBuiltinTemplate,
  listBuiltinTemplates,
  type FullTemplate,
} from "@/lib/builtin-templates";
import { userTemplatePath } from "@/lib/db/local";
import { getStorageProvider, isFirebaseReady } from "@/lib/db";
import {
  readTemplateOverride as readFirebaseTemplateOverride,
  writeTemplateOverride as writeFirebaseTemplateOverride,
} from "@/lib/db/firebase-templates";
import { BUILTIN_TEMPLATE_IDS, BUILTIN_TEMPLATE_ORDER } from "@/lib/templates";

export type { FullTemplate } from "@/lib/builtin-templates";

type TemplateContent = FullTemplate["default"];

function readLocalOverride(userId: string, templateId: string): TemplateContent | null {
  try {
    const filepath = userTemplatePath(userId, templateId);
    if (!fs.existsSync(filepath)) return null;
    const data = JSON.parse(fs.readFileSync(filepath, "utf-8")) as FullTemplate;
    return data.default ?? null;
  } catch {
    return null;
  }
}

function writeLocalOverride(userId: string, templateId: string, content: TemplateContent) {
  const dir = path.dirname(userTemplatePath(userId, templateId));
  fs.mkdirSync(dir, { recursive: true });
  const builtin = getBuiltinTemplate(templateId);
  if (!builtin) throw new Error("Template not found");
  const data: FullTemplate = {
    ...builtin,
    default: content,
    variants: {},
  };
  fs.writeFileSync(userTemplatePath(userId, templateId), JSON.stringify(data, null, 2), "utf-8");
}

async function readOverride(
  userId: string,
  templateId: string,
): Promise<TemplateContent | null> {
  if (getStorageProvider() === "firebase" && isFirebaseReady()) {
    const override = await readFirebaseTemplateOverride(userId, templateId);
    if (!override?.subject && !override?.body) return null;
    return {
      subject: override.subject,
      body: override.body,
    };
  }
  return readLocalOverride(userId, templateId);
}

function mergeTemplate(builtin: FullTemplate, override: TemplateContent | null): FullTemplate {
  if (!override) return builtin;
  return {
    ...builtin,
    default: {
      subject: override.subject || builtin.default.subject,
      body: override.body || builtin.default.body,
    },
    variants: {},
  };
}

export function seedStarterTemplate(_userId: string) {
  // Built-in templates ship with the app; no per-user seeding required.
}

export async function loadUserTemplate(
  userId: string,
  templateId: string,
): Promise<FullTemplate | null> {
  if (!BUILTIN_TEMPLATE_IDS.has(templateId)) return null;
  const builtin = getBuiltinTemplate(templateId);
  if (!builtin) return null;
  const override = await readOverride(userId, templateId);
  return mergeTemplate(builtin, override);
}

export async function loadUserTemplates(userId: string): Promise<FullTemplate[]> {
  const builtins = listBuiltinTemplates();
  if (!userId) return builtins;

  const templates: FullTemplate[] = [];
  for (const id of BUILTIN_TEMPLATE_ORDER) {
    const tpl = await loadUserTemplate(userId, id);
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

export async function saveUserTemplate(
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

  const existing = await loadUserTemplate(userId, templateId);
  if (!existing) throw new Error("Template not found");

  const content: TemplateContent = {
    subject: updates.subject !== undefined ? updates.subject : existing.default.subject,
    body: updates.body !== undefined ? updates.body : existing.default.body,
  };

  if (getStorageProvider() === "firebase" && isFirebaseReady()) {
    await writeFirebaseTemplateOverride(userId, templateId, content);
  } else {
    writeLocalOverride(userId, templateId, content);
  }

  return mergeTemplate(getBuiltinTemplate(templateId)!, content);
}
