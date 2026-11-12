import { calculateTaxLine, southAfricanVatRateBasisPoints, type PriceMode, type TaxTreatment } from "@/lib/tax";

export type DocumentLineItem = {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxTreatment?: TaxTreatment;
  priceMode?: PriceMode;
  taxRateBasisPoints?: number;
};

export type DocumentTaxBreakdown = {
  lines: Array<DocumentLineItem & { netMinor: number; taxMinor: number; grossMinor: number; appliedRateBasisPoints: number }>;
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
};

export function validateDocumentLineItems(items: DocumentLineItem[]): DocumentLineItem[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new Error("A document must contain between 1 and 50 line items.");
  return items.map((item, index) => {
    if (!item.description.trim() || item.description.length > 500) throw new Error("Line " + (index + 1) + " needs a description of 1–500 characters.");
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000) throw new Error("Line " + (index + 1) + " quantity must be a positive whole number.");
    if (!Number.isSafeInteger(item.unitPriceMinor) || item.unitPriceMinor <= 0) throw new Error("Line " + (index + 1) + " unit price must be a positive safe integer in minor units.");
    const total = item.quantity * item.unitPriceMinor;
    if (!Number.isSafeInteger(total)) throw new Error("Line " + (index + 1) + " total exceeds the supported amount range.");
    if (item.taxTreatment && !["standard", "zero_rated", "exempt", "out_of_scope"].includes(item.taxTreatment)) throw new Error("Line " + (index + 1) + " has an unsupported tax treatment.");
    if (item.priceMode && item.priceMode !== "inclusive" && item.priceMode !== "exclusive") throw new Error("Line " + (index + 1) + " has an unsupported price mode.");
    if (item.taxRateBasisPoints !== undefined && (!Number.isInteger(item.taxRateBasisPoints) || item.taxRateBasisPoints < 0 || item.taxRateBasisPoints > 10_000)) throw new Error("Line " + (index + 1) + " has an invalid tax rate.");
    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      ...(item.taxTreatment ? { taxTreatment: item.taxTreatment } : {}),
      ...(item.priceMode ? { priceMode: item.priceMode } : {}),
      ...(item.taxRateBasisPoints !== undefined ? { taxRateBasisPoints: item.taxRateBasisPoints } : {})
    };
  });
}

/** Applies the workspace's VAT registration and the date-specific SARS standard rate. */
export function applyDocumentTaxProfile(
  items: DocumentLineItem[],
  options: { vatRegistered: boolean; taxDate: string; priceMode?: PriceMode }
): DocumentLineItem[] {
  const valid = validateDocumentLineItems(items);
  return valid.map((item, index) => {
    if (!options.vatRegistered && item.taxTreatment && item.taxTreatment !== "out_of_scope") {
      throw new Error("Only a VAT-registered workspace can issue VAT-rated documents. Update the VAT profile first.");
    }
    const treatment = options.vatRegistered ? (item.taxTreatment ?? "standard") : "out_of_scope";
    const rate = treatment === "standard" ? southAfricanVatRateBasisPoints(options.taxDate) : 0;
    return {
      ...item,
      taxTreatment: treatment,
      priceMode: item.priceMode ?? options.priceMode ?? "inclusive",
      taxRateBasisPoints: rate
    };
  });
}

/** Calculates document tax from stored line rates; no AI or floating-point arithmetic is involved. */
export function calculateDocumentTax(items: DocumentLineItem[]): DocumentTaxBreakdown {
  const valid = validateDocumentLineItems(items);
  let netMinor = 0;
  let taxMinor = 0;
  let grossMinor = 0;
  const lines = valid.map(item => {
    const treatment = item.taxTreatment ?? "out_of_scope";
    if (treatment === "standard" && item.taxRateBasisPoints === undefined) throw new Error("Standard-rated lines must store the tax rate used when the document was prepared.");
    const rate = treatment === "standard" ? item.taxRateBasisPoints! : 0;
    const mode = item.priceMode ?? "exclusive";
    const amountMinor = item.quantity * item.unitPriceMinor;
    const result = calculateTaxLine(amountMinor, rate, mode);
    netMinor += result.netMinor;
    taxMinor += result.taxMinor;
    grossMinor += result.grossMinor;
    if (!Number.isSafeInteger(netMinor) || !Number.isSafeInteger(taxMinor) || !Number.isSafeInteger(grossMinor)) {
      throw new Error("Document tax total exceeds the supported amount range.");
    }
    return { ...item, netMinor: result.netMinor, taxMinor: result.taxMinor, grossMinor: result.grossMinor, appliedRateBasisPoints: rate };
  });
  return { lines, netMinor, taxMinor, grossMinor };
}

export function calculateDocumentTotal(items: DocumentLineItem[]): number {
  return calculateDocumentTax(items).grossMinor;
}

export function resolveDocumentLineItems(
  lineItems: DocumentLineItem[] | null | undefined,
  legacy: DocumentLineItem
): DocumentLineItem[] {
  return validateDocumentLineItems(lineItems?.length ? lineItems : [legacy]);
}
