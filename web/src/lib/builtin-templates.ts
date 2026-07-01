import { BUILTIN_TEMPLATE_ORDER } from "@/lib/templates";
import aiAgent from "../../data/templates/ai_agent.json";
import freeDemoWebsite from "../../data/templates/free_demo_website.json";

export interface FullTemplate {
  id: string;
  label: string;
  description: string;
  color: string;
  default: { subject: string; body: string };
  variants?: Record<string, { subject: string; body: string }>;
}

const BUILTIN_BY_ID: Record<string, FullTemplate> = {
  free_demo_website: freeDemoWebsite as FullTemplate,
  ai_agent: aiAgent as FullTemplate,
};

export function getBuiltinTemplate(templateId: string): FullTemplate | null {
  const tpl = BUILTIN_BY_ID[templateId];
  return tpl ? structuredClone(tpl) : null;
}

export function listBuiltinTemplates(): FullTemplate[] {
  return BUILTIN_TEMPLATE_ORDER.map((id) => getBuiltinTemplate(id)).filter(
    (tpl): tpl is FullTemplate => tpl !== null,
  );
}
