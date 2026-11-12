import { calculateDocumentTotal, type DocumentLineItem } from "./documents";

export type AssistantPriceReference =
  | { type: "source"; index: number }
  | { type: "explicit"; index: number };

export type AssistantProposedLine = {
  description: string;
  quantity: number;
  priceSource: AssistantPriceReference;
};

export type AssistantExplicitAmount = { currency: string; amountMinor: number };
export type PreparedAssistantDocumentDraft = { lineItems: DocumentLineItem[]; totalMinor: number };

export function prepareAssistantDocumentDraft(input: {
  proposedLines: AssistantProposedLine[];
  sourceLineItems: DocumentLineItem[];
  explicitAmounts: AssistantExplicitAmount[];
  currency: string;
  hoursAddition?: number | null;
  mentionsHours?: boolean;
}): PreparedAssistantDocumentDraft {
  const { proposedLines, sourceLineItems, explicitAmounts, currency } = input;
  const hoursAddition = input.hoursAddition ?? null;
  const hourlySourceIndices = sourceLineItems
    .map((item, index) => /\b(hours?|labou?r)\b/i.test(item.description) ? index : -1)
    .filter(index => index >= 0);

  if (hoursAddition !== null && (!Number.isSafeInteger(hoursAddition) || hoursAddition <= 0 || hourlySourceIndices.length !== 1)) {
    throw new Error("I couldn't identify one unambiguous hourly labour line in the source document. Please confirm the hourly rate and which line should receive the additional hours.");
  }

  const lineItems: DocumentLineItem[] = [];
  let hoursAdditionApplied = false;
  for (const line of proposedLines) {
    if (!line.description.trim() || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1_000_000) {
      throw new Error("Every proposed line needs a description and a positive whole-number quantity.");
    }
    if (line.priceSource.type === "source") {
      const sourceLine = sourceLineItems[line.priceSource.index];
      if (!sourceLine || sourceLine.description.toLowerCase() !== line.description.toLowerCase()) {
        throw new Error("I couldn't verify a historical price for one of these lines. Use the exact source line description or provide its price.");
      }
      if (input.mentionsHours && !/\b(hours?|labou?r)\b/i.test(sourceLine.description)) {
        throw new Error("The previous document doesn't identify this line as hourly labour. Please confirm the hourly rate before I add hours.");
      }
      let quantity = line.quantity;
      if (hoursAddition !== null && line.priceSource.index === hourlySourceIndices[0]) {
        quantity = sourceLine.quantity + hoursAddition;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
          throw new Error("The adjusted labour quantity is outside the supported range.");
        }
        hoursAdditionApplied = true;
      }
      lineItems.push({ description: sourceLine.description, quantity, unitPriceMinor: sourceLine.unitPriceMinor });
    } else {
      const stated = explicitAmounts[line.priceSource.index];
      if (!stated || stated.currency !== currency || !Number.isSafeInteger(stated.amountMinor) || stated.amountMinor <= 0) {
        throw new Error("I couldn't match a user-stated price to one of these lines. Please state its price and currency explicitly.");
      }
      lineItems.push({ description: line.description.trim(), quantity: line.quantity, unitPriceMinor: stated.amountMinor });
    }
  }
  if (hoursAddition !== null && !hoursAdditionApplied) {
    throw new Error("I couldn't safely apply the additional hours to a verified hourly source line. Please confirm the hourly rate and source line.");
  }
  return { lineItems, totalMinor: calculateDocumentTotal(lineItems) };
}
