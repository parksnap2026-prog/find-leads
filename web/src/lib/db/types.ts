export type UserRole = "admin" | "user";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface MailSettings {
  server: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface EmailLogEntry {
  id: string;
  sentAt: string;
  businessName: string;
  emailAddress: string;
  template: string;
  subject: string;
  city: string;
  country: string;
  businessType: string;
  testReal: "Test" | "Real";
}

export interface CallLogEntry {
  id: string;
  calledAt: string;
  action: string;
  businessName: string;
  businessId: string;
  phone: string;
  city: string;
  country: string;
}

export interface CallLogState {
  [businessId: string]: {
    called: boolean;
    calledAt: string;
    name: string;
    phone: string;
    email?: string;
    website?: string;
    city: string;
    country: string;
    businessType?: string;
  };
}

export interface ScrapeResult {
  has_agent: boolean;
  platforms: string[];
  emails: string[];
  phones: string[];
  name: string;
  checked: boolean;
  is_social: boolean;
  error: string | null;
  /** direct = fast fetch; rendered = browser-style fallback (Jina/Panda/RapidAPI) */
  scrapeMethod?: "direct" | "rendered";
  renderProvider?: string;
}
