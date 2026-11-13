export const DOCUMENT_TEMPLATES = [
  { id: "classic", name: "Classic", description: "Formal typography and a clear, traditional document layout." },
  { id: "modern", name: "Modern", description: "A balanced, contemporary layout with a strong brand accent." },
  { id: "minimal", name: "Minimal", description: "Quiet, spacious and stripped back." },
  { id: "bold", name: "Bold", description: "A confident dark header and high-contrast totals." },
  { id: "editorial", name: "Editorial", description: "Large type, generous spacing and an editorial hierarchy." },
  { id: "custom", name: "Start from scratch", description: "A clean base you can make your own with your logo and colours." },
] as const;

export type DocumentTemplateId = typeof DOCUMENT_TEMPLATES[number]["id"];
export type DocumentSettings = {
  templateId: DocumentTemplateId;
  accentColor: string;
  logoDataUrl: string | null;
  brandName: string;
};

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  templateId: "modern",
  accentColor: "#245b49",
  logoDataUrl: null,
  brandName: "",
};

export function resolveDocumentSettings(value?: Partial<DocumentSettings> | null): DocumentSettings {
  const templateId = DOCUMENT_TEMPLATES.some((template) => template.id === value?.templateId)
    ? value!.templateId!
    : DEFAULT_DOCUMENT_SETTINGS.templateId;
  const accentColor = typeof value?.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.accentColor)
    ? value.accentColor
    : DEFAULT_DOCUMENT_SETTINGS.accentColor;
  const logoDataUrl = typeof value?.logoDataUrl === "string" && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.logoDataUrl)
    ? value.logoDataUrl
    : null;
  const brandName = typeof value?.brandName === "string" ? value.brandName.slice(0, 120) : "";
  return { templateId, accentColor, logoDataUrl, brandName };
}
