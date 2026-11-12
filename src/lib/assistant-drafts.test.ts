import { describe, expect, it } from "vitest";
import { prepareAssistantDocumentDraft } from "./assistant-drafts";

describe("AI-assisted document draft preparation", () => {
  const sourceLineItems = [
    { description: "Labour hours", quantity: 4, unitPriceMinor: 75_000 },
    { description: "Materials", quantity: 1, unitPriceMinor: 120_000 }
  ];

  it("reuses exact historical line prices and calculates the total deterministically", () => {
    const result = prepareAssistantDocumentDraft({
      proposedLines: [
        { description: "Labour hours", quantity: 4, priceSource: { type: "source", index: 0 } },
        { description: "Materials", quantity: 1, priceSource: { type: "source", index: 1 } }
      ],
      sourceLineItems, explicitAmounts: [], currency: "ZAR"
    });
    expect(result.lineItems).toEqual(sourceLineItems);
    expect(result.totalMinor).toBe(420_000);
  });

  it("uses only explicitly stated amounts matched by reference index and currency", () => {
    const result = prepareAssistantDocumentDraft({
      proposedLines: [{ description: "Emergency call-out", quantity: 2, priceSource: { type: "explicit", index: 0 } }],
      sourceLineItems: [], explicitAmounts: [{ currency: "ZAR", amountMinor: 50_000 }], currency: "ZAR"
    });
    expect(result.lineItems[0]?.unitPriceMinor).toBe(50_000);
    expect(result.totalMinor).toBe(100_000);
  });

  it("adds requested hours to the verified hourly source quantity without changing its rate", () => {
    const result = prepareAssistantDocumentDraft({
      proposedLines: [{ description: "Labour hours", quantity: 4, priceSource: { type: "source", index: 0 } }],
      sourceLineItems, explicitAmounts: [], currency: "ZAR", hoursAddition: 3, mentionsHours: true
    });
    expect(result.lineItems[0]).toEqual({ description: "Labour hours", quantity: 7, unitPriceMinor: 75_000 });
    expect(result.totalMinor).toBe(525_000);
  });

  it("refuses a mismatched historical description instead of guessing a price", () => {
    expect(() => prepareAssistantDocumentDraft({
      proposedLines: [{ description: "Consulting", quantity: 1, priceSource: { type: "source", index: 0 } }],
      sourceLineItems, explicitAmounts: [], currency: "ZAR"
    })).toThrow(/couldn't verify a historical price/);
  });

  it("refuses an explicit price reference in the wrong currency", () => {
    expect(() => prepareAssistantDocumentDraft({
      proposedLines: [{ description: "Materials", quantity: 1, priceSource: { type: "explicit", index: 0 } }],
      sourceLineItems: [], explicitAmounts: [{ currency: "USD", amountMinor: 50_000 }], currency: "ZAR"
    })).toThrow(/user-stated price/);
  });

  it("rejects ambiguous hourly source lines and unsafe quantity changes", () => {
    expect(() => prepareAssistantDocumentDraft({
      proposedLines: [{ description: "Labour hours", quantity: 4, priceSource: { type: "source", index: 0 } }],
      sourceLineItems: [...sourceLineItems, { description: "Additional labour", quantity: 1, unitPriceMinor: 80_000 }],
      explicitAmounts: [], currency: "ZAR", hoursAddition: 1, mentionsHours: true
    })).toThrow(/unambiguous hourly labour line/);
    expect(() => prepareAssistantDocumentDraft({
      proposedLines: [{ description: "Labour hours", quantity: 1_000_000, priceSource: { type: "source", index: 0 } }],
      sourceLineItems: [{ description: "Labour hours", quantity: 1_000_000, unitPriceMinor: 75_000 }],
      explicitAmounts: [], currency: "ZAR", hoursAddition: 1, mentionsHours: true
    })).toThrow(/adjusted labour quantity/);
  });
});
