export type DocumentLineItem = {
  description: string;
  quantity: number;
  unitPriceMinor: number;
};

export function validateDocumentLineItems(items: DocumentLineItem[]): DocumentLineItem[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new Error("A document must contain between 1 and 50 line items.");
  return items.map((item, index) => {
    if (!item.description.trim() || item.description.length > 500) throw new Error("Line " + (index + 1) + " needs a description of 1–500 characters.");
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000) throw new Error("Line " + (index + 1) + " quantity must be a positive whole number.");
    if (!Number.isSafeInteger(item.unitPriceMinor) || item.unitPriceMinor <= 0) throw new Error("Line " + (index + 1) + " unit price must be a positive safe integer in minor units.");
    const total = item.quantity * item.unitPriceMinor;
    if (!Number.isSafeInteger(total)) throw new Error("Line " + (index + 1) + " total exceeds the supported amount range.");
    return { description: item.description.trim(), quantity: item.quantity, unitPriceMinor: item.unitPriceMinor };
  });
}

export function calculateDocumentTotal(items: DocumentLineItem[]): number {
  const valid = validateDocumentLineItems(items);
  return valid.reduce((total, item) => {
    const next = total + item.quantity * item.unitPriceMinor;
    if (!Number.isSafeInteger(next)) throw new Error("Document total exceeds the supported amount range.");
    return next;
  }, 0);
}

export function resolveDocumentLineItems(
  lineItems: DocumentLineItem[] | null | undefined,
  legacy: DocumentLineItem
): DocumentLineItem[] {
  return validateDocumentLineItems(lineItems?.length ? lineItems : [legacy]);
}
