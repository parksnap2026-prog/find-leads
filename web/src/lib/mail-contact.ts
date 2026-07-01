import { getMailSettings } from "@/lib/db/user-mail";
import type { MailSettings } from "@/lib/db/types";
import { normalizeWebsite } from "@/lib/listings";

export interface MailContactContext {
  businessName: string;
  email: string;
  phone: string;
  website: string;
  storeUrl: string;
  city: string;
  businessType: string;
}

export function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function getMailContactContext(
  userId: string,
  mail?: MailSettings | null,
  userName?: string,
): Promise<MailContactContext> {
  const { readUserListing } = await import("@/lib/listings");
  const listing = await readUserListing(userId);
  const saved = mail ?? (await getMailSettings(userId));

  const businessName =
    listing?.name?.trim() ||
    saved?.fromName?.trim() ||
    userName?.trim() ||
    "MyBusinessesLeads";

  const email = listing?.email?.trim() || saved?.user?.trim() || "";

  return {
    businessName,
    email,
    phone: listing?.phone?.trim() || "",
    website: listing?.website ? normalizeWebsite(listing.website) : "",
    storeUrl: listing?.published ? `/store/${userId}` : "",
    city: listing?.city?.trim() || "your city",
    businessType: listing?.businessType || "hair_salon",
  };
}

/** Logo + sender block appended to outreach emails when a variant omits it. */
export const EMAIL_SIGNATURE_BLOCK = `<tr><td style="background:#ffffff;padding:0 40px"><div style="border-top:1px solid #e2e8f0"></div></td></tr>
<tr><td style="background:#ffffff;padding:18px 40px 26px">
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:top;padding-right:14px"><img src="cid:logo_webpower" alt="WebPower" width="64" style="border:0"></td>
    <td style="vertical-align:top">
      <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 2px">[Your Name]</p>
      <p style="font-size:13px;color:#64748b;margin:0 0 4px">[Your Company] · Websites for local businesses</p>
      <p style="font-size:13px;margin:0"><a href="mailto:[Your Email]" style="color:#0047AB;text-decoration:none">[Your Email]</a></p>
    </td>
  </tr></table>
</td></tr>`;

export const EMAIL_UNSUBSCRIBE_FOOTER = `<tr><td style="background:#0f172a;border-radius:0 0 14px 14px;padding:16px 40px;text-align:center">
  <p style="color:#64748b;font-size:12px;margin:0">© 2026 WebPower · <a href="mailto:business@webpower.blog" style="color:#475569;text-decoration:none">Unsubscribe</a></p>
</td></tr>`;

const SHORT_VARIANT_FOOTER_RE =
  /<p style="font-size:13px;color:#64748b;margin:24px 0 0">Best regards,<br><strong>\[Your Name\]<\/strong><\/p>\s*<\/td><\/tr>\s*<tr><td style="background:#0f172a;border-radius:0 0 14px 14px;padding:14px;text-align:center"><p style="color:#64748b;font-size:12px;margin:0">WebPower · Digital solutions for local businesses<\/p><\/td><\/tr>/i;

export function hasEmailSignatureBlock(html: string) {
  return /\[Your Company\]/i.test(html);
}

/** Category variants use a one-line footer — swap in the full signature before send. */
export function ensureEmailSignature(html: string) {
  if (hasEmailSignatureBlock(html)) return html;
  if (SHORT_VARIANT_FOOTER_RE.test(html)) {
    return html.replace(
      SHORT_VARIANT_FOOTER_RE,
      `</td></tr>\n${EMAIL_SIGNATURE_BLOCK}\n${EMAIL_UNSUBSCRIBE_FOOTER}`,
    );
  }
  return html;
}

export function stripPhoneFromTemplate(text: string) {
  const out = text
    .replace(
      /<a\s+[^>]*href=["']tel:[^"']*["'][^>]*>[\s\S]*?<\/a>\s*(?:&nbsp;\s*)*·\s*(?:&nbsp;\s*)*/gi,
      "",
    )
    .replace(/<a\s+[^>]*href=["']tel:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/\[Your Phone\]\s*\|\s*/g, "")
    .replace(/\[Your Phone\]\s*·\s*/g, "")
    .replace(/\[Your Phone\]/g, "")
    .replace(/\{\{FROM_PHONE\}\}\s*\|\s*/g, "")
    .replace(/\{\{FROM_PHONE\}\}/g, "");

  return out;
}

export function applyContactToTemplate(text: string, ctx: MailContactContext) {
  const baseUrl = getAppBaseUrl();
  const storeFullUrl = ctx.storeUrl ? `${baseUrl}${ctx.storeUrl}` : "";
  const siteLink = ctx.website || storeFullUrl || (ctx.email ? `mailto:${ctx.email}` : "#");
  const year = String(new Date().getFullYear());

  let out = text
    .replace(/\{\{FROM_NAME\}\}/g, ctx.businessName)
    .replace(/\{\{FROM_EMAIL\}\}/g, ctx.email)
    .replace(/\{\{FROM_WEBSITE\}\}/g, ctx.website || storeFullUrl)
    .replace(/\{\{STORE_URL\}\}/g, storeFullUrl);

  out = out.replace(/mailto:business@webpower\.blog/gi, ctx.email ? `mailto:${ctx.email}` : "#");
  out = out.replace(/https?:\/\/webpower\.blog\/?/gi, siteLink);
  out = out.replace(/(?<!@)webpower\.blog\/?/gi, ctx.website
    ? ctx.website.replace(/^https?:\/\//, "")
    : storeFullUrl.replace(/^https?:\/\//, "") || "mybusinessesleads.com");
  out = out.replace(/The WebPower Team/g, ctx.businessName);
  out = out.replace(/WebPower Team/g, ctx.businessName);
  out = out.replace(/© 2025 WebPower/g, `© ${year} ${ctx.businessName}`);
  out = out.replace(/alt="WebPower"/gi, `alt="${ctx.businessName}"`);

  return stripPhoneFromTemplate(out);
}

export async function resolveMailFromFields(
  userId: string,
  settings: MailSettings,
  userName?: string,
): Promise<MailSettings> {
  const ctx = await getMailContactContext(userId, settings, userName);
  return {
    ...settings,
    fromName: settings.fromName.trim() || ctx.businessName,
    fromEmail: ctx.email || settings.user,
  };
}
