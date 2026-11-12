import { describe, expect, it } from "vitest";
import { createDocumentPdf } from "./document-pdf";

describe("shareable document PDF", () => {
  const input = {
    type: "invoice" as const, number: "INV-0042", businessName: "Buttercode Studio",
    businessAddress: "Gqeberha, South Africa", vatNumber: "4123456789",
    customerName: "Acme Services", customerEmail: "accounts@example.com",
    issueDate: "2026-11-12", dueDate: "2026-11-26", currency: "ZAR",
    lineItems: [
      { description: "Product design", quantity: 2, unitPriceMinor: 125050, taxTreatment: "standard" as const, priceMode: "inclusive" as const, taxRateBasisPoints: 1500 },
      { description: "Research", quantity: 1, unitPriceMinor: 50000, taxTreatment: "zero_rated" as const, priceMode: "exclusive" as const, taxRateBasisPoints: 0 }
    ]
  };

  it("creates a valid PDF file with the actual document data and VAT totals", async () => {
    const blob = createDocumentPdf(input);
    expect(blob.type).toBe("application/pdf");
    const source = await blob.text();
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect(source).toContain("INV-0042");
    expect(source).toContain("Buttercode Studio");
    expect(source).toContain("Acme Services");
    expect(source).toContain("Product design");
    expect(source).toContain("VAT");
    expect(source).toContain("xref");
    expect(source.endsWith("%%EOF")).toBe(true);
  });

  it("supports invoice and quotation outputs with three selectable template treatments", async () => {
    const modern = await createDocumentPdf(input).text();
    const minimal = await createDocumentPdf({ ...input, template: "minimal" }).text();
    const classic = await createDocumentPdf({ ...input, type: "quotation", number: "QUO-0042", validUntil: "2026-12-12", template: "classic" }).text();
    expect(modern).not.toBe(minimal);
    expect(minimal).not.toBe(classic);
    expect(classic).toContain("QUOTATION");
    expect(classic).toContain("QUO-0042");
  });
});
