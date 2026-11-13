import { describe, expect, it } from "vitest";
import { DEFAULT_DOCUMENT_SETTINGS, DOCUMENT_TEMPLATES, resolveDocumentSettings } from "./document-design";

describe("branded document settings", () => {
  it("provides six usable starting templates including a blank custom style", () => {
    expect(DOCUMENT_TEMPLATES).toHaveLength(6);
    expect(DOCUMENT_TEMPLATES.map((item) => item.id)).toContain("custom");
  });
  it("keeps valid brand settings and safely falls back for invalid values", () => {
    expect(resolveDocumentSettings({ templateId: "classic", accentColor: "#123456", brandName: "Studio" })).toMatchObject({
      templateId: "classic", accentColor: "#123456", brandName: "Studio",
    });
    expect(resolveDocumentSettings({ templateId: "not-a-template" as never, accentColor: "red" })).toEqual(DEFAULT_DOCUMENT_SETTINGS);
  });
  it("rejects non-image logo payloads", () => {
    expect(resolveDocumentSettings({ logoDataUrl: "javascript:alert(1)" }).logoDataUrl).toBeNull();
  });
});
