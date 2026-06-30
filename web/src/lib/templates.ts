import fs from "fs";
import path from "path";
import type { MessageTemplate } from "@/types";

const TEMPLATES_DIR = path.join(process.cwd(), "data", "templates");
const ORDER = ["free_demo_website", "create_build", "update_maintain", "ai_agent"];

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

  const ordered = ORDER.filter((id) => loaded[id]).map((id) => ({
    id: loaded[id].id,
    label: loaded[id].label,
    description: loaded[id].description,
    color: loaded[id].color,
  }));

  const rest = Object.values(loaded)
    .filter((t) => !ORDER.includes(t.id))
    .map(({ id, label, description, color }) => ({ id, label, description, color }));

  return [...ordered, ...rest];
}
