export type TaxTreatment = "standard" | "zero_rated" | "exempt" | "out_of_scope";
export type PriceMode = "exclusive" | "inclusive";

export type TaxCalculation = {
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  rateBasisPoints: number;
};

const DAY_MS = 86_400_000;

function validDate(value: string, field: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(field + " must be an ISO date (YYYY-MM-DD).");
  const time = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error(field + " is not a valid calendar date.");
  return time;
}

function assertMoney(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(field + " must be a non-negative safe integer in minor currency units.");
}

function assertRate(rateBasisPoints: number): void {
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 10_000) {
    throw new Error("Tax rate must be between 0% and 100%, in basis points.");
  }
}

function safeAdd(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new Error("Tax total exceeds the safe integer range.");
  return result;
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Tax denominator must be positive.");
  const whole = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? whole + 1n : whole;
}

/** Generic deterministic tax calculation. All amounts are integer minor units. */
export function calculateTaxLine(amountMinor: number, rateBasisPoints: number, priceMode: PriceMode): TaxCalculation {
  assertMoney(amountMinor, "Amount");
  assertRate(rateBasisPoints);
  if (priceMode !== "inclusive" && priceMode !== "exclusive") throw new Error("Choose whether the entered price includes tax.");
  const rate = BigInt(rateBasisPoints);
  const amount = BigInt(amountMinor);
  let net: bigint;
  let tax: bigint;
  let gross: bigint;
  if (priceMode === "exclusive") {
    net = amount;
    tax = roundHalfUp(net * rate, 10_000n);
    gross = net + tax;
  } else {
    gross = amount;
    tax = rate === 0n ? 0n : roundHalfUp(gross * rate, 10_000n + rate);
    net = gross - tax;
  }
  for (const [value, label] of [[net, "Net"], [tax, "Tax"], [gross, "Gross"]] as const) {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(label + " amount exceeds the supported range.");
  }
  return { netMinor: Number(net), taxMinor: Number(tax), grossMinor: Number(gross), rateBasisPoints };
}

/** SARS standard VAT rate by time-of-supply date. */
export function southAfricanVatRateBasisPoints(taxDate: string): number {
  const time = validDate(taxDate, "Tax date");
  return time < Date.UTC(2018, 3, 1) ? 1_400 : 1_500;
}

export type VatTransaction = {
  id: string;
  date: string;
  direction: "sale" | "purchase";
  treatment: TaxTreatment;
  amountMinor: number;
  currency: string;
  priceMode: PriceMode;
  /** Required for input-tax claims. This must be reviewed, not inferred by AI. */
  inputTaxClaimed?: boolean;
  supportingDocumentVerified?: boolean;
  businessUseBasisPoints?: number;
  capitalGoods?: boolean;
};

export type Vat201Summary = {
  periodStart: string;
  periodEnd: string;
  currency: "ZAR";
  standardRatedSalesExVatMinor: number;
  zeroRatedSalesMinor: number;
  exemptAndNonSupplySalesMinor: number;
  outputVatMinor: number;
  capitalGoodsPurchasesExVatMinor: number;
  otherPurchasesExVatMinor: number;
  capitalGoodsInputVatMinor: number;
  otherInputVatMinor: number;
  inputVatMinor: number;
  netVatPayableMinor: number;
  unclaimedPurchaseVatMinor: number;
  transactionCount: number;
  warnings: string[];
};

/**
 * Prepares a conservative VAT201 working summary. It does not submit a return
 * or determine legal eligibility for an input-tax deduction.
 */
export function prepareSouthAfricanVat201(periodStart: string, periodEnd: string, transactions: VatTransaction[]): Vat201Summary {
  const start = validDate(periodStart, "VAT period start");
  const end = validDate(periodEnd, "VAT period end");
  if (end < start) throw new Error("VAT period end cannot be before its start.");

  const summary: Vat201Summary = {
    periodStart, periodEnd, currency: "ZAR",
    standardRatedSalesExVatMinor: 0,
    zeroRatedSalesMinor: 0,
    exemptAndNonSupplySalesMinor: 0,
    outputVatMinor: 0,
    capitalGoodsPurchasesExVatMinor: 0,
    otherPurchasesExVatMinor: 0,
    capitalGoodsInputVatMinor: 0,
    otherInputVatMinor: 0,
    inputVatMinor: 0,
    netVatPayableMinor: 0,
    unclaimedPurchaseVatMinor: 0,
    transactionCount: 0,
    warnings: []
  };

  for (const transaction of transactions) {
    const date = validDate(transaction.date, "Transaction date");
    if (date < start || date > end) continue;
    if (transaction.currency !== "ZAR") throw new Error("VAT201 preparation currently requires ZAR transactions. Convert foreign-currency transactions using a documented exchange rate before inclusion.");
    assertMoney(transaction.amountMinor, "Transaction " + transaction.id);
    const defaultRate = transaction.treatment === "standard" ? southAfricanVatRateBasisPoints(transaction.date) : 0;
    const rate = defaultRate;
    const line = calculateTaxLine(transaction.amountMinor, rate, transaction.priceMode);
    summary.transactionCount++;

    if (transaction.direction === "sale") {
      if (transaction.treatment === "standard") {
        summary.standardRatedSalesExVatMinor = safeAdd(summary.standardRatedSalesExVatMinor, line.netMinor);
        summary.outputVatMinor = safeAdd(summary.outputVatMinor, line.taxMinor);
      } else if (transaction.treatment === "zero_rated") {
        summary.zeroRatedSalesMinor = safeAdd(summary.zeroRatedSalesMinor, line.grossMinor);
      } else {
        summary.exemptAndNonSupplySalesMinor = safeAdd(summary.exemptAndNonSupplySalesMinor, line.grossMinor);
      }
      continue;
    }

    if (transaction.treatment === "standard") {
      if (transaction.capitalGoods) summary.capitalGoodsPurchasesExVatMinor = safeAdd(summary.capitalGoodsPurchasesExVatMinor, line.netMinor);
      else summary.otherPurchasesExVatMinor = safeAdd(summary.otherPurchasesExVatMinor, line.netMinor);
      const businessUse = transaction.businessUseBasisPoints ?? 10_000;
      assertRate(businessUse);
      const canClaim = transaction.inputTaxClaimed === true && transaction.supportingDocumentVerified === true && businessUse > 0;
      if (canClaim) {
        const claim = Number(roundHalfUp(BigInt(line.taxMinor) * BigInt(businessUse), 10_000n));
        if (transaction.capitalGoods) summary.capitalGoodsInputVatMinor = safeAdd(summary.capitalGoodsInputVatMinor, claim);
        else summary.otherInputVatMinor = safeAdd(summary.otherInputVatMinor, claim);
      } else {
        summary.unclaimedPurchaseVatMinor = safeAdd(summary.unclaimedPurchaseVatMinor, line.taxMinor);
        if (line.taxMinor > 0) summary.warnings.push("Purchase " + transaction.id + " has VAT not included in the input-tax claim; verify the supporting tax invoice, business use and eligibility.");
      }
    }
  }

  summary.inputVatMinor = safeAdd(summary.capitalGoodsInputVatMinor, summary.otherInputVatMinor);
  summary.netVatPayableMinor = summary.outputVatMinor - summary.inputVatMinor;
  if (!Number.isSafeInteger(summary.netVatPayableMinor)) throw new Error("Net VAT amount exceeds the safe integer range.");
  if (summary.exemptAndNonSupplySalesMinor > 0) summary.warnings.push("Exempt supplies and non-supplies are grouped for this working summary; review apportionment and VAT201 field mapping with a tax practitioner.");
  if (summary.zeroRatedSalesMinor > 0) summary.warnings.push("Zero-rated sales are grouped; separate exports and other zero-rated supplies where the applicable VAT201 fields require it.");
  return summary;
}

export type ZaTaxInvoiceFields = {
  currency: string;
  considerationZarMinor: number;
  supplierVatRegistered: boolean;
  supplierName?: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientIsVatVendor?: boolean;
  recipientVatNumber?: string;
  serialNumber?: string;
  issueDate?: string;
  supplyDate?: string;
  documentTitle?: string;
  description?: string;
  quantity?: number;
  valueExVatMinor?: number;
  vatMinor?: number;
  totalInclVatMinor?: number;
};

export type ZaTaxInvoiceValidation = {
  requiredDocument: "not_required" | "abridged" | "full";
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/** Conservative checklist based on SARS's published tax-invoice requirements. */
export function validateSouthAfricanTaxInvoice(fields: ZaTaxInvoiceFields): ZaTaxInvoiceValidation {
  assertMoney(fields.considerationZarMinor, "Rand consideration");
  const requiredDocument = fields.considerationZarMinor <= 5_000 ? "not_required" : fields.considerationZarMinor <= 500_000 ? "abridged" : "full";
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!/^[A-Z]{3}$/.test(fields.currency)) errors.push("Currency must be a three-letter ISO code.");
  if (requiredDocument === "not_required") {
    warnings.push("At this consideration amount, SARS does not require a tax invoice. Retain appropriate supporting evidence if input tax is to be considered.");
    return { requiredDocument, valid: errors.length === 0, errors, warnings };
  }

  const required = (value: string | undefined, label: string) => { if (!value?.trim()) errors.push(label + " is required."); };
  if (!fields.supplierVatRegistered) errors.push("The supplier has not confirmed VAT-vendor registration; do not label this document a VAT tax invoice.");
  required(fields.supplierName, "Supplier name");
  required(fields.supplierAddress, "Supplier address");
  required(fields.supplierVatNumber, "Supplier VAT registration number");
  required(fields.serialNumber, "Unique serial number");
  required(fields.issueDate, "Issue date");
  required(fields.documentTitle, "Document title");
  required(fields.description, "Description of goods or services");
  if (fields.supplierVatNumber && !/^\d{10}$/.test(fields.supplierVatNumber)) errors.push("Supplier VAT registration number must contain 10 digits.");
  if (fields.documentTitle && !/^(tax invoice|vat invoice|invoice)$/i.test(fields.documentTitle.trim())) errors.push('Document title must say "Tax Invoice", "VAT Invoice" or "Invoice".');
  if (fields.issueDate) validDate(fields.issueDate, "Issue date");

  if (requiredDocument === "full") {
    required(fields.recipientName, "Recipient name");
    required(fields.recipientAddress, "Recipient address");
    required(fields.quantity === undefined ? undefined : String(fields.quantity), "Quantity or volume");
    required(fields.valueExVatMinor === undefined ? undefined : String(fields.valueExVatMinor), "Value excluding VAT");
    if (fields.quantity !== undefined && (!Number.isFinite(fields.quantity) || fields.quantity <= 0)) errors.push("Quantity or volume must be greater than zero.");
    if (fields.valueExVatMinor !== undefined) assertMoney(fields.valueExVatMinor, "Value excluding VAT");
    if (fields.recipientIsVatVendor) {
      required(fields.recipientVatNumber, "Recipient VAT registration number");
      if (fields.recipientVatNumber && !/^\d{10}$/.test(fields.recipientVatNumber)) errors.push("Recipient VAT registration number must contain 10 digits.");
    }
  }
  if (fields.vatMinor === undefined || fields.totalInclVatMinor === undefined) errors.push("VAT amount and total consideration must be shown.");
  if (fields.vatMinor !== undefined) assertMoney(fields.vatMinor, "VAT amount");
  if (fields.totalInclVatMinor !== undefined) assertMoney(fields.totalInclVatMinor, "Total consideration");
  if (fields.valueExVatMinor !== undefined && fields.vatMinor !== undefined && fields.totalInclVatMinor !== undefined) {
    const calculatedTotal = fields.valueExVatMinor + fields.vatMinor;
    if (!Number.isSafeInteger(calculatedTotal) || calculatedTotal !== fields.totalInclVatMinor) errors.push("Value excluding VAT plus VAT must equal the total consideration.");
  }
  if (fields.currency === "ZAR" && fields.totalInclVatMinor !== undefined && fields.totalInclVatMinor !== fields.considerationZarMinor) errors.push("The displayed total must match the rand consideration used for the SARS threshold.");
  if (fields.supplyDate && fields.issueDate) {
    const days = Math.floor((validDate(fields.issueDate, "Issue date") - validDate(fields.supplyDate, "Supply date")) / DAY_MS);
    if (days > 21) warnings.push("The issue date is more than 21 days after the supply date; check the statutory time-of-issue rules and any exceptions.");
  }
  if (fields.currency !== "ZAR") warnings.push("Rand consideration was supplied separately for the SARS document threshold; retain the exchange-rate source used.");
  return { requiredDocument, valid: errors.length === 0, errors, warnings };
}
