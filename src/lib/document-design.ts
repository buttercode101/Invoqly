export const DOCUMENT_TEMPLATES = [
  { id: "modern", name: "Modern", description: "Balanced, contemporary and easy to scan." },
  { id: "minimal", name: "Minimal", description: "Quiet, spacious and stripped back." },
  { id: "classic", name: "Classic", description: "Formal typography and traditional structure." },
  { id: "bold", name: "Bold", description: "A confident dark header with strong contrast." },
  { id: "editorial", name: "Editorial", description: "Expressive typography and generous whitespace." },
  { id: "custom", name: "Start from scratch", description: "A clean canvas for your own brand identity." },
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
  const templateId = DOCUMENT_TEMPLATES.some((item) => item.id === value?.templateId)
    ? value!.templateId!
    : DEFAULT_DOCUMENT_SETTINGS.templateId;
  const accentColor = typeof value?.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.accentColor)
    ? value.accentColor
    : DEFAULT_DOCUMENT_SETTINGS.accentColor;
  const logoDataUrl = typeof value?.logoDataUrl === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.logoDataUrl)
    ? value.logoDataUrl
    : null;
  const brandName = typeof value?.brandName === "string" ? value.brandName.slice(0, 120) : "";
  return { templateId, accentColor, logoDataUrl, brandName };
}
