import fs from "fs";
import path from "path";
import type { MessageTemplate } from "@/types";

const TEMPLATES_DIR = path.join(process.cwd(), "data", "templates");
export const BUILTIN_TEMPLATE_ORDER = ["free_demo_website", "ai_agent"] as const;
export type BuiltinTemplateId = (typeof BUILTIN_TEMPLATE_ORDER)[number];

export const BUILTIN_TEMPLATE_IDS = new Set<string>(BUILTIN_TEMPLATE_ORDER);

export const TEMPLATE_PRODUCT_LINK: Record<string, string> = {
  free_demo_website: "https://webpower.blog",
  ai_agent: "https://receptionsit.com",
};

export const TEMPLATE_PRODUCT_LABEL: Record<string, string> = {
  free_demo_website: "webpower.blog",
  ai_agent: "receptionsit.com",
};

export function loadTemplates(): MessageTemplate[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];

  const loaded: Record<string, MessageTemplate & { variants?: unknown }> = {};
  for (const fname of fs.readdirSync(TEMPLATES_DIR)) {
    if (!fname.endsWith(".json")) continue;
    const raw = JSON.parse(
      fs.readFileSync(path.join(TEMPLATES_DIR, fname), "utf-8"),
    ) as MessageTemplate & { variants?: unknown };
    loaded[raw.id] = raw;
  }

  const ordered = BUILTIN_TEMPLATE_ORDER.filter((id) => loaded[id]).map((id) => ({
    id: loaded[id].id,
    label: loaded[id].label,
    description: loaded[id].description,
    color: loaded[id].color,
  }));

  return ordered;
}
