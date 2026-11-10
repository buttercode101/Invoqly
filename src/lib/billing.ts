export type InvoiceStatus = "Draft" | "Sent" | "Partially paid" | "Paid" | "Overdue";

function assertMinorUnits(value:number,label:string):void {
  if(!Number.isSafeInteger(value)||value<0) throw new Error(`${label} must be a non-negative safe integer.`);
}

export function outstandingBalanceMinor(totalMinor:number,paymentAmountsMinor:readonly number[]):number {
  assertMinorUnits(totalMinor,"Invoice total");
  let paid=0n;
  for(const amount of paymentAmountsMinor){assertMinorUnits(amount,"Payment amount");paid+=BigInt(amount);}
  const total=BigInt(totalMinor);
  if(paid>total) throw new Error("Recorded payments exceed the invoice total.");
  return Number(total-paid);
}

export function deriveInvoiceStatus(totalMinor:number,paidMinor:number,dueDate:string,today:string):Exclude<InvoiceStatus,"Draft"> {
  assertMinorUnits(totalMinor,"Invoice total");
  assertMinorUnits(paidMinor,"Paid amount");
  if(paidMinor>totalMinor) throw new Error("Recorded payments exceed the invoice total.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Dates must use YYYY-MM-DD.");
  if(paidMinor===totalMinor) return "Paid";
  if(dueDate<today) return "Overdue";
  if(paidMinor>0) return "Partially paid";
  return "Sent";
}
