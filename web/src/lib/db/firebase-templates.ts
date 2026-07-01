import { getFirebaseDb } from "./firebase-admin";

export interface TemplateOverride {
  subject: string;
  body: string;
  updatedAt: string;
}

export async function readTemplateOverride(
  userId: string,
  templateId: string,
): Promise<TemplateOverride | null> {
  const doc = await getFirebaseDb()
    .collection("users")
    .doc(userId)
    .collection("prefs")
    .doc("templates")
    .collection("items")
    .doc(templateId)
    .get();
  if (!doc.exists) return null;
  const data = doc.data() as Partial<TemplateOverride>;
  if (!data.subject && !data.body) return null;
  return {
    subject: data.subject ?? "",
    body: data.body ?? "",
    updatedAt: data.updatedAt ?? "",
  };
}

export async function writeTemplateOverride(
  userId: string,
  templateId: string,
  override: Pick<TemplateOverride, "subject" | "body">,
): Promise<void> {
  await getFirebaseDb()
    .collection("users")
    .doc(userId)
    .collection("prefs")
    .doc("templates")
    .collection("items")
    .doc(templateId)
    .set({
      ...override,
      updatedAt: new Date().toISOString(),
    });
}
