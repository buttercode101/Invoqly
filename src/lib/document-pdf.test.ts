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
  it("creates a valid PDF with actual document data and VAT totals", async () => {
    const blob=createDocumentPdf(input);
    expect(blob.type).toBe("application/pdf");
    const source=await blob.text();
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect(source).toContain("INV-0042");
    expect(source).toContain("Buttercode Studio");
    expect(source).toContain("Acme Services");
    expect(source).toContain("Product design");
    expect(source).toContain("VAT");
    expect(source).toContain("xref");
    expect(source.endsWith("%%EOF")).toBe(true);
  });
  it("creates separate valid page streams for long documents", async () => {
    const long={...input,lineItems:Array.from({length:48},(_,index)=>({description:"Service line "+(index+1),quantity:1,unitPriceMinor:10000,taxTreatment:"out_of_scope" as const,priceMode:"exclusive" as const}))};
    const source=await createDocumentPdf(long).text();
    expect(source).toContain("/Count 2");
    expect(source.split("/Type /Page ").length-1).toBe(2);
    expect(source).toContain("Service line 48");
  });
  it("supports six distinct invoice and quotation templates", async () => {
    const outputs=await Promise.all(["modern","minimal","classic","bold","editorial","custom"].map(template=>createDocumentPdf({...input,template:template as any}).text()));
    expect(new Set(outputs).size).toBe(6);
    const quote=await createDocumentPdf({...input,type:"quotation",number:"QUO-0042",validUntil:"2026-12-12",template:"classic"}).text();
    expect(quote).toContain("QUOTATION");
    expect(quote).toContain("QUO-0042");
  });
  it("embeds uploaded logo and signed approval as JPEG PDF image objects", async () => {
    const pixelJpeg="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAB//2Q==";
    const source=await createDocumentPdf({...input,logoDataUrl:pixelJpeg,signatureDataUrl:pixelJpeg,signerName:"Jane Client",decisionAt:"2026-11-13T09:00:00.000Z",agreementAt:"2026-11-13T08:59:00.000Z"}).text();
    expect(source).toContain("/Subtype /Image");
    expect(source).toContain("/ImLogo Do");
    expect(source).toContain("/ImSignature Do");
    expect(source).toContain("Signed by Jane Client");
    expect(source).toContain("Scope and terms accepted");
  });
});
