export type CashflowInvoice = {
  id: string;
  number: string;
  customerName: string;
  dueDate: string;
  amountMinor: number;
  paidMinor?: number;
  status: "Draft" | "Sent" | "Partially paid" | "Paid" | "Overdue";
  currency: string;
};

export type CashflowOutflow = {
  id: string;
  label: string;
  date: string;
  amountMinor: number;
  currency: string;
};

export type CashflowPayable = {
  id: string;
  label: string;
  dueDate: string;
  amountMinor: number;
  currency: string;
};

export type RecurringCashflowItem = {
  id: string;
  label: string;
  direction: "inflow" | "outflow";
  amountMinor: number;
  currency: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string;
  endDate?: string;
  dayOfMonth?: number;
};

export type CashflowScenario = {
  /** Move selected receivable dates later. */
  delayedInvoiceIds?: string[];
  /** Number of days by which selected receivables are delayed. */
  invoiceDelayDays?: number;
  /** Move selected supplier payable dates later. */
  delayedPayableIds?: string[];
  /** Number of days by which selected supplier payments are delayed. */
  supplierDelayDays?: number;
  /** Additional one-off cash events, positive for inflows and negative for outflows. */
  adjustments?: Array<{ id: string; label: string; date: string; amountMinor: number; currency: string }>;
};

export type CashflowInput = {
  asOfDate: string;
  currency: string;
  /** Current cleared cash balance, not an estimate of future receipts. */
  openingBalanceMinor: number | null;
  reserveMinor?: number;
  invoices: CashflowInvoice[];
  outflows?: CashflowOutflow[];
  payables?: CashflowPayable[];
  recurring?: RecurringCashflowItem[];
};

export type CashflowEvent = {
  id: string;
  label: string;
  date: string;
  direction: "inflow" | "outflow";
  amountMinor: number;
  source: "invoice" | "outflow" | "payable" | "recurring" | "scenario";
};

export type CashflowPeriod = {
  startDate: string;
  endDate: string;
  inflowsMinor: number;
  outflowsMinor: number;
  netMinor: number;
  openingBalanceMinor: number | null;
  closingBalanceMinor: number | null;
};

export type CashflowForecast = {
  currency: string;
  asOfDate: string;
  events: CashflowEvent[];
  weeks: CashflowPeriod[];
  months: CashflowPeriod[];
  lowestProjectedBalanceMinor: number | null;
  lowestProjectedBalanceDate: string | null;
  safeToSpendMinor: number | null;
};

const DAY_MS = 86_400_000;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function parseDate(value: string, field: string): number {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) throw new Error(field + " must be an ISO date (YYYY-MM-DD).");
  const time = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error(field + " is not a valid calendar date.");
  return time;
}

function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return iso(parseDate(date, "Date") + days * DAY_MS);
}

function addMonths(date: string, months: number, dayOfMonth?: number): string {
  const base = new Date(parseDate(date, "Date"));
  const targetMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth ?? base.getUTCDate(), lastDay);
  targetMonth.setUTCDate(day);
  return iso(targetMonth.getTime());
}

function assertAmount(amount: number, label: string, allowZero = false): void {
  if (!Number.isSafeInteger(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new Error(label + " must be a " + (allowZero ? "non-negative" : "positive") + " safe integer in minor currency units.");
  }
}

function addSafe(a: number, b: number): number {
  const value = a + b;
  if (!Number.isSafeInteger(value)) throw new Error("Forecast total exceeds the safe integer range.");
  return value;
}

function assertCurrency(currency: string, expected: string, label: string): void {
  if (!/^[A-Z]{3}$/.test(currency) || currency !== expected) {
    throw new Error(label + " must use the forecast currency (" + expected + "). FX conversion is not implicit.");
  }
}

function recurringEvents(items: RecurringCashflowItem[], asOf: string, end: string, currency: string): CashflowEvent[] {
  const events: CashflowEvent[] = [];
  const startTime = parseDate(asOf, "asOfDate");
  const endTime = parseDate(end, "Forecast end date");
  for (const item of items) {
    assertCurrency(item.currency, currency, "Recurring item " + item.id);
    assertAmount(item.amountMinor, "Recurring item " + item.id);
    const itemStart = parseDate(item.startDate, "Recurring startDate");
    const itemEnd = item.endDate ? parseDate(item.endDate, "Recurring endDate") : endTime;
    if (item.endDate && itemEnd < itemStart) throw new Error("Recurring endDate cannot be before startDate.");
    const intervalMonths = item.frequency === "monthly" ? 1 : item.frequency === "quarterly" ? 3 : item.frequency === "yearly" ? 12 : 0;
    if (item.frequency !== "weekly" && (!Number.isInteger(item.dayOfMonth ?? 1) || (item.dayOfMonth ?? 1) < 1 || (item.dayOfMonth ?? 1) > 31)) {
      throw new Error("Recurring dayOfMonth must be between 1 and 31.");
    }
    if (item.frequency === "weekly") {
      for (let cursor = itemStart; cursor <= endTime && cursor <= itemEnd; cursor += 7 * DAY_MS) {
        if (cursor >= startTime) events.push({ id: item.id + ":" + iso(cursor), label: item.label, date: iso(cursor), direction: item.direction, amountMinor: item.amountMinor, source: "recurring" });
      }
    } else {
      let cursor = item.startDate;
      let guard = 0;
      while (parseDate(cursor, "Recurring date") <= endTime && parseDate(cursor, "Recurring date") <= itemEnd) {
        const cursorTime = parseDate(cursor, "Recurring date");
        if (cursorTime >= startTime) events.push({ id: item.id + ":" + cursor, label: item.label, date: cursor, direction: item.direction, amountMinor: item.amountMinor, source: "recurring" });
        cursor = addMonths(cursor, intervalMonths, item.dayOfMonth);
        if (++guard > 240) throw new Error("Recurring schedule exceeds the supported 20-year forecast range.");
      }
    }
  }
  return events;
}

function buildEvents(input: CashflowInput, scenario: CashflowScenario = {}): CashflowEvent[] {
  const asOfTime = parseDate(input.asOfDate, "asOfDate");
  const horizonEnd = addMonths(input.asOfDate, 12, 1);
  const endTime = parseDate(horizonEnd, "Forecast end date");
  const events: CashflowEvent[] = [];
  const delayedInvoices = new Set(scenario.delayedInvoiceIds ?? []);
  const delayedPayables = new Set(scenario.delayedPayableIds ?? []);
  const invoiceDelay = scenario.invoiceDelayDays ?? 0;
  const supplierDelay = scenario.supplierDelayDays ?? 0;
  if (!Number.isSafeInteger(invoiceDelay) || invoiceDelay < 0 || !Number.isSafeInteger(supplierDelay) || supplierDelay < 0) {
    throw new Error("Scenario delays must be non-negative whole days.");
  }

  for (const invoice of input.invoices) {
    if (invoice.status === "Draft" || invoice.status === "Paid") continue;
    assertCurrency(invoice.currency, input.currency, "Invoice " + invoice.number);
    assertAmount(invoice.amountMinor, "Invoice " + invoice.number);
    const paid = invoice.paidMinor ?? 0;
    assertAmount(paid, "Payments for invoice " + invoice.number, true);
    if (paid > invoice.amountMinor) throw new Error("Payments cannot exceed invoice " + invoice.number + ".");
    const open = invoice.amountMinor - paid;
    if (open === 0) continue;
    const due = parseDate(invoice.dueDate, "Invoice dueDate");
    let expected = Math.max(due, asOfTime);
    if (delayedInvoices.has(invoice.id)) expected += invoiceDelay * DAY_MS;
    if (expected <= endTime) events.push({ id: "invoice:" + invoice.id, label: invoice.number + " · " + invoice.customerName, date: iso(expected), direction: "inflow", amountMinor: open, source: "invoice" });
  }

  for (const outflow of input.outflows ?? []) {
    assertCurrency(outflow.currency, input.currency, "Outflow " + outflow.id);
    assertAmount(outflow.amountMinor, "Outflow " + outflow.id);
    const date = parseDate(outflow.date, "Outflow date");
    if (date >= asOfTime && date <= endTime) events.push({ id: "outflow:" + outflow.id, label: outflow.label, date: outflow.date, direction: "outflow", amountMinor: outflow.amountMinor, source: "outflow" });
  }

  for (const payable of input.payables ?? []) {
    assertCurrency(payable.currency, input.currency, "Payable " + payable.id);
    assertAmount(payable.amountMinor, "Payable " + payable.id);
    const due = parseDate(payable.dueDate, "Payable dueDate");
    let expected = Math.max(due, asOfTime);
    if (delayedPayables.has(payable.id)) expected += supplierDelay * DAY_MS;
    if (expected <= endTime) events.push({ id: "payable:" + payable.id, label: payable.label, date: iso(expected), direction: "outflow", amountMinor: payable.amountMinor, source: "payable" });
  }

  events.push(...recurringEvents(input.recurring ?? [], input.asOfDate, horizonEnd, input.currency));
  for (const adjustment of scenario.adjustments ?? []) {
    assertCurrency(adjustment.currency, input.currency, "Scenario adjustment " + adjustment.id);
    if (!Number.isSafeInteger(adjustment.amountMinor) || adjustment.amountMinor === 0) throw new Error("Scenario adjustments must be non-zero safe integers in minor currency units.");
    const date = parseDate(adjustment.date, "Scenario adjustment date");
    if (date >= asOfTime && date <= endTime) events.push({ id: "scenario:" + adjustment.id, label: adjustment.label, date: adjustment.date, direction: adjustment.amountMinor > 0 ? "inflow" : "outflow", amountMinor: Math.abs(adjustment.amountMinor), source: "scenario" });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function periods(input: CashflowInput, events: CashflowEvent[], mode: "week" | "month"): CashflowPeriod[] {
  const buckets: Array<{ start: string; end: string }> = [];
  if (mode === "week") {
    for (let i = 0; i < 13; i++) {
      const start = addDays(input.asOfDate, i * 7);
      buckets.push({ start, end: addDays(start, 6) });
    }
  } else {
    let start = input.asOfDate;
    for (let i = 0; i < 12; i++) {
      const nextMonth = addMonths(start.slice(0, 7) + "-01", 1, 1);
      buckets.push({ start, end: addDays(nextMonth, -1) });
      start = nextMonth;
    }
  }

  let balance = input.openingBalanceMinor;
  return buckets.map(bucket => {
    let inflows = 0;
    let outflows = 0;
    for (const event of events) {
      if (event.date < bucket.start || event.date > bucket.end) continue;
      if (event.direction === "inflow") inflows = addSafe(inflows, event.amountMinor);
      else outflows = addSafe(outflows, event.amountMinor);
    }
    const net = inflows - outflows;
    if (!Number.isSafeInteger(net)) throw new Error("Forecast net movement exceeds the safe integer range.");
    const opening = balance;
    if (balance !== null) balance = addSafe(balance, net);
    return { startDate: bucket.start, endDate: bucket.end, inflowsMinor: inflows, outflowsMinor: outflows, netMinor: net, openingBalanceMinor: opening, closingBalanceMinor: balance };
  });
}

export function calculateCashflow(input: CashflowInput, scenario: CashflowScenario = {}): CashflowForecast {
  parseDate(input.asOfDate, "asOfDate");
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Forecast currency must be a three-letter ISO code.");
  if (input.openingBalanceMinor !== null && !Number.isSafeInteger(input.openingBalanceMinor)) throw new Error("Opening balance must be a safe integer in minor currency units.");
  const reserve = input.reserveMinor ?? 0;
  assertAmount(reserve, "Cash reserve", true);
  const events = buildEvents(input, scenario);
  const weeks = periods(input, events, "week");
  const months = periods(input, events, "month");
  let lowest: number | null = input.openingBalanceMinor;
  let lowestDate: string | null = input.openingBalanceMinor === null ? null : input.asOfDate;
  for (const period of weeks) {
    if (period.closingBalanceMinor !== null && (lowest === null || period.closingBalanceMinor < lowest)) {
      lowest = period.closingBalanceMinor;
      lowestDate = period.endDate;
    }
  }
  const safeToSpend = lowest === null ? null : Math.max(0, lowest - reserve);
  return { currency: input.currency, asOfDate: input.asOfDate, events, weeks, months, lowestProjectedBalanceMinor: lowest, lowestProjectedBalanceDate: lowestDate, safeToSpendMinor: safeToSpend };
}

export function rankReceivablesToChase(input: Pick<CashflowInput, "asOfDate" | "currency" | "invoices">, limit = 3): Array<{ invoiceId: string; number: string; customerName: string; openAmountMinor: number; daysOverdue: number }> {
  parseDate(input.asOfDate, "asOfDate");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100.");
  return input.invoices.flatMap(invoice => {
    if (invoice.status === "Draft" || invoice.status === "Paid") return [];
    assertCurrency(invoice.currency, input.currency, "Invoice " + invoice.number);
    assertAmount(invoice.amountMinor, "Invoice " + invoice.number);
    const paid = invoice.paidMinor ?? 0;
    assertAmount(paid, "Payments for invoice " + invoice.number, true);
    if (paid > invoice.amountMinor) throw new Error("Payments cannot exceed invoice " + invoice.number + ".");
    const openAmountMinor = invoice.amountMinor - paid;
    if (!openAmountMinor) return [];
    const daysOverdue = Math.max(0, Math.floor((parseDate(input.asOfDate, "asOfDate") - parseDate(invoice.dueDate, "Invoice dueDate")) / DAY_MS));
    return [{ invoiceId: invoice.id, number: invoice.number, customerName: invoice.customerName, openAmountMinor, daysOverdue }];
  }).sort((a, b) => b.openAmountMinor - a.openAmountMinor || b.daysOverdue - a.daysOverdue).slice(0, limit);
}

export function totalChaseImpactMinor(items: Array<{ openAmountMinor: number }>): number {
  return items.reduce((sum, item) => addSafe(sum, item.openAmountMinor), 0);
}
