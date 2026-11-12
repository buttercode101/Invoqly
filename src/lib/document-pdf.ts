import { calculateDocumentTax, type DocumentLineItem } from "@/lib/documents";

export type DocumentPdfInput = {
  type: "invoice" | "quotation";
  number: string;
  businessName: string;
  businessAddress?: string;
  vatNumber?: string;
  customerName: string;
  customerCompany?: string;
  customerEmail?: string;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  status?: string;
  currency: string;
  lineItems: DocumentLineItem[];
  template?: "modern" | "minimal" | "classic";
};

const money = (minor: number, currency: string) => new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(minor / 100);
const clean = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
const esc = (value: string) => clean(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const wrap = (value: string, max = 72) => {
  const words = clean(value).split(" ");
  const rows: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) { rows.push(line); line = word; }
    else line = (line + " " + word).trim();
  }
  if (line) rows.push(line);
  return rows.length ? rows : [" "];
};

/** Small dependency-free, selectable-text PDF. The browser can share this actual PDF file. */
export function createDocumentPdf(input: DocumentPdfInput): Blob {
  const template = input.template ?? "modern";
  const accent = template === "classic" ? "0.12 0.25 0.19" : template === "minimal" ? "0.28 0.31 0.29" : "0.13 0.34 0.25";
  const pages: string[][] = [];
  let commands: string[] = [];
  const newPage = () => {
    if (commands.length) pages.push(commands);
    commands = ["BT", "/F2 9 Tf", "48 800 Td", "14 TL"];
  };
  let y = 790;
  const textAt = (x: number, yy: number, value: string, size = 9, bold = false, color = "0.16 0.20 0.17") =>
    `BT ${color} rg /${bold ? "F2" : "F1"} ${size} Tf ${x} ${yy} Td (${esc(value)}) Tj ET`;
  commands.push(`0.13 0.34 0.25 rg 48 752 499 3 re f`);
  commands.push(textAt(48, 810, input.businessName || "Your business", 19, true, accent));
  wrap(input.businessAddress || "", 68).slice(0, 2).forEach((v, i) => commands.push(textAt(48, 735 - i * 12, v, 8, false, "0.38 0.42 0.39")));
  if (input.vatNumber) commands.push(textAt(48, 707, "VAT registration: " + input.vatNumber, 8));
  commands.push(textAt(400, 810, input.type.toUpperCase(), 15, true, accent));
  commands.push(textAt(400, 790, input.number, 10, true));
  commands.push(textAt(400, 772, "Issued  " + input.issueDate, 8));
  commands.push(textAt(400, 758, (input.type === "invoice" ? "Due  " + (input.dueDate ?? "") : "Valid until  " + (input.validUntil ?? "")), 8));
  commands.push(textAt(48, 674, input.type === "invoice" ? "BILL TO" : "PREPARED FOR", 8, true, accent));
  commands.push(textAt(48, 657, input.customerName, 11, true));
  if (input.customerCompany) commands.push(textAt(48, 643, input.customerCompany, 9));
  if (input.customerEmail) commands.push(textAt(48, 629, input.customerEmail, 8));
  commands.push(`0.91 0.93 0.91 RG 48 606 m 547 606 l S`);
  commands.push(textAt(48, 588, "DESCRIPTION", 8, true, accent));
  commands.push(textAt(380, 588, "QTY", 8, true, accent));
  commands.push(textAt(430, 588, "UNIT PRICE", 8, true, accent));
  commands.push(textAt(505, 588, "TOTAL", 8, true, accent));
  y = 568;
  const breakdown = calculateDocumentTax(input.lineItems);
  for (const item of breakdown.lines) {
    const rows = wrap(item.description, 48);
    if (y < 100) { commands.push(textAt(48, 42, "Continued on next page", 7, false, "0.45 0.48 0.46")); newPage(); y = 790; }
    commands.push(textAt(48, y, rows[0]!, 8));
    commands.push(textAt(380, y, String(item.quantity), 8));
    commands.push(textAt(430, y, money(item.unitPriceMinor, input.currency), 8));
    commands.push(textAt(505, y, money(item.quantity * item.unitPriceMinor, input.currency), 8));
    y -= 15;
    for (const continuation of rows.slice(1)) { commands.push(textAt(48, y, continuation, 8)); y -= 12; }
    commands.push(`0.91 0.93 0.91 RG 48 ${y + 5} m 547 ${y + 5} l S`);
    y -= 5;
  }
  if (y < 160) { newPage(); y = 790; }
  const totalX = 385;
  commands.push(textAt(totalX, y - 8, "Subtotal", 9));
  commands.push(textAt(490, y - 8, money(breakdown.netMinor, input.currency), 9));
  commands.push(textAt(totalX, y - 26, "VAT", 9));
  commands.push(textAt(490, y - 26, money(breakdown.taxMinor, input.currency), 9));
  commands.push(`0.13 0.34 0.25 rg 380 ${y - 38} 167 1.5 re f`);
  commands.push(textAt(totalX, y - 60, "TOTAL", 11, true, accent));
  commands.push(textAt(480, y - 60, money(breakdown.grossMinor, input.currency), 11, true, accent));
  commands.push(textAt(48, 42, "Prepared with Invoqly", 7, false, "0.48 0.52 0.49"));
  pages.push(commands);
  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    const stream = page.join("\n");
    const contentId = add(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(output).length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { output += String(offset).padStart(10, "0") + " 00000 n \n"; });
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([output], { type: "application/pdf" });
}
