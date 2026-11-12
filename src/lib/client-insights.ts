export type ClientInsightClient = { id: string; name: string; currency: string };
export type ClientInsightInvoice = {
  id: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  status: string;
};
export type ClientInsightPayment = {
  invoiceId: string;
  date: string;
  amountMinor: number;
  currency: string;
  method: string;
};

export type ClientPaymentProfile = {
  clientId: string;
  clientName: string;
  currency: string;
  onTimeRatePercent: number | null;
  averageDaysToPay: number | null;
  preferredPaymentMethod: string | null;
  overdueBalanceMinor: number;
  dueInvoiceCount: number;
  onTimeInvoiceCount: number;
  paidInvoiceCount: number;
  lateInvoiceCount: number;
  confidence: "low" | "medium" | "high" | "none";
};

const DAY_MS = 86_400_000;

function parseDate(value: string, label: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(label + " must be an ISO date.");
  const time = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error(label + " is not a valid calendar date.");
  return time;
}

function addSafe(a: number, b: number): number {
  const value = a + b;
  if (!Number.isSafeInteger(value)) throw new Error("Client payment totals exceed the supported amount range.");
  return value;
}

/** Derives transparent client payment behaviour from issued invoices and recorded payment ledger entries. */
export function buildClientPaymentProfiles(input: {
  asOfDate: string;
  clients: ClientInsightClient[];
  invoices: ClientInsightInvoice[];
  payments: ClientInsightPayment[];
}): ClientPaymentProfile[] {
  parseDate(input.asOfDate, "As-of date");
  const paymentByInvoice = new Map<string, ClientInsightPayment[]>();
  for (const payment of input.payments) {
    parseDate(payment.date, "Payment date");
    if (!Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) throw new Error("Payment amounts must be positive safe integers.");
    const rows = paymentByInvoice.get(payment.invoiceId) ?? [];
    rows.push(payment);
    paymentByInvoice.set(payment.invoiceId, rows);
  }

  return input.clients.map(client => {
    const dueInvoices = input.invoices.filter(invoice =>
      invoice.clientId === client.id &&
      invoice.currency === client.currency &&
      invoice.status !== "Draft" &&
      parseDate(invoice.dueDate, "Invoice due date") <= parseDate(input.asOfDate, "As-of date")
    );
    let onTimeInvoiceCount = 0;
    let paidInvoiceCount = 0;
    let lateInvoiceCount = 0;
    let overdueBalanceMinor = 0;
    const paymentDays: number[] = [];
    const methods = new Map<string, { count: number; latestDate: string }>();

    for (const invoice of dueInvoices) {
      const total = invoice.quantity * invoice.unitPriceMinor;
      if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Invoice total is invalid for client payment analysis.");
      const rows = paymentByInvoice.get(invoice.id) ?? [];
      const paid = rows.filter(payment => payment.currency === invoice.currency);
      const paidMinor = paid.reduce((sum, payment) => addSafe(sum, payment.amountMinor), 0);
      const fullyPaid = paidMinor >= total;
      const latestPaymentDate = paid.map(payment => payment.date).sort().at(-1) ?? null;

      if (fullyPaid && latestPaymentDate) {
        paidInvoiceCount++;
        const days = Math.max(0, Math.floor((parseDate(latestPaymentDate, "Payment date") - parseDate(invoice.issueDate, "Invoice issue date")) / DAY_MS));
        paymentDays.push(days);
        if (latestPaymentDate <= invoice.dueDate) onTimeInvoiceCount++;
        else lateInvoiceCount++;
      } else {
        overdueBalanceMinor = addSafe(overdueBalanceMinor, Math.max(0, total - paidMinor));
        lateInvoiceCount++;
      }

      for (const payment of paid) {
        const method = payment.method.trim();
        if (!method) continue;
        const current = methods.get(method) ?? { count: 0, latestDate: "" };
        methods.set(method, { count: current.count + 1, latestDate: payment.date > current.latestDate ? payment.date : current.latestDate });
      }
    }

    const preferredPaymentMethod = [...methods.entries()]
      .sort((a, b) => b[1].count - a[1].count || b[1].latestDate.localeCompare(a[1].latestDate) || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    const onTimeRatePercent = dueInvoices.length ? Math.round(onTimeInvoiceCount / dueInvoices.length * 100) : null;
    const averageDaysToPay = paymentDays.length ? Math.round(paymentDays.reduce((sum, days) => sum + days, 0) / paymentDays.length) : null;
    const confidence = dueInvoices.length >= 5 ? "high" : dueInvoices.length >= 3 ? "medium" : dueInvoices.length > 0 ? "low" : "none";

    return {
      clientId: client.id,
      clientName: client.name,
      currency: client.currency,
      onTimeRatePercent,
      averageDaysToPay,
      preferredPaymentMethod,
      overdueBalanceMinor,
      dueInvoiceCount: dueInvoices.length,
      onTimeInvoiceCount,
      paidInvoiceCount,
      lateInvoiceCount,
      confidence
    };
  }).sort((a, b) =>
    (b.overdueBalanceMinor - a.overdueBalanceMinor) ||
    (a.onTimeRatePercent ?? 101) - (b.onTimeRatePercent ?? 101) ||
    a.clientName.localeCompare(b.clientName)
  );
}
