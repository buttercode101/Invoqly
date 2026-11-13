import { describe, expect, it } from "vitest";
import { DEFAULT_DOCUMENT_SETTINGS, DOCUMENT_TEMPLATES, resolveDocumentSettings } from "./document-design";

describe("document design settings", () => {
  it("provides five distinct templates and a start-from-scratch canvas", () => {
    expect(DOCUMENT_TEMPLATES).toHaveLength(6);
    expect(DOCUMENT_TEMPLATES.map((item) => item.id)).toEqual(["modern","minimal","classic","bold","editorial","custom"]);
  });
  it("normalizes invalid settings and accepts supported brand values", () => {
    expect(resolveDocumentSettings({templateId:"classic",accentColor:"#123456",brandName:"Studio"})).toMatchObject({templateId:"classic",accentColor:"#123456",brandName:"Studio"});
    expect(resolveDocumentSettings({templateId:"invalid" as never,accentColor:"red"})).toEqual(DEFAULT_DOCUMENT_SETTINGS);
  });
  it("only accepts bounded JPEG data URLs for embedded logos", () => {
    expect(resolveDocumentSettings({logoDataUrl:"data:image/png;base64,abc"}).logoDataUrl).toBeNull();
    expect(resolveDocumentSettings({logoDataUrl:"javascript:alert(1)"}).logoDataUrl).toBeNull();
  });
});
