import { BUSINESS_TYPES } from "./constants";
import { loadUserTemplate } from "./user-templates";
import {
  applyContactToTemplate,
  ensureEmailSignature,
  getMailContactContext,
  stripPhoneFromTemplate,
} from "./mail-contact";
import type { MailSettings } from "./db/types";

async function fillTemplate(
  text: string,
  vars: { name: string; city: string; type: string },
  mail?: MailSettings | null,
  userId?: string,
  userName?: string,
) {
  const ctx = userId
    ? await getMailContactContext(userId, mail, userName)
    : {
        businessName: mail?.fromName || "MyBusinessesLeads",
        email: mail?.user || "",
        phone: "",
        website: "",
        storeUrl: "",
        city: vars.city,
        businessType: "",
      };

  const fromName = mail?.fromName?.trim() || userName?.trim() || ctx.businessName;
  const companyName = ctx.businessName;
  const fromEmail = ctx.email || mail?.user || "";

  let out = ensureEmailSignature(text)
    .replace(/\{\{NAME\}\}/g, vars.name)
    .replace(/\{\{CITY\}\}/g, vars.city)
    .replace(/\{\{TYPE\}\}/g, vars.type)
    .replace(/\[Your Name\]/g, fromName)
    .replace(/\[Your Company\]/g, companyName)
    .replace(/\[Your Email\]/g, fromEmail);

  out = stripPhoneFromTemplate(out);

  if (userId) {
    out = applyContactToTemplate(out, ctx);
  }

  return out;
}

export async function composeMessage(
  userId: string,
  input: {
    template_id: string;
    name: string;
    business_type: string;
    city: string;
  },
  mail?: MailSettings | null,
  contactUserId?: string,
  userName?: string,
) {
  const tpl = loadUserTemplate(userId, input.template_id);
  if (!tpl) throw new Error("Template not found");

  const typeLabel = (BUSINESS_TYPES[input.business_type] || input.business_type).toLowerCase();
  const content = tpl.default;

  const vars = {
    name: input.name.trim() || "your business",
    city: input.city.trim() || "your city",
    type: typeLabel,
  };

  const uid = contactUserId ?? userId;

  return {
    subject: await fillTemplate(content.subject || "", vars, mail, uid, userName),
    body: await fillTemplate(content.body || "", vars, mail, uid, userName),
  };
}
