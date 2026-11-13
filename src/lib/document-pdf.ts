import { calculateDocumentTax, type DocumentLineItem } from "@/lib/documents";
import { currencyExponent } from "@/lib/money";
import type { DocumentTemplateId } from "@/lib/document-design";

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
  template?: DocumentTemplateId;
  brandName?: string;
  accentColor?: string;
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;
  signerName?: string | null;
  decisionAt?: string | null;
  agreementAt?: string | null;
};

type JpegImage = { width:number; height:number; hex:string };

const money = (minor: number, currency: string) => currency + " " + (minor / (10 ** currencyExponent(currency))).toFixed(currencyExponent(currency));
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
const color = (hex:string) => {
  const value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : "245b49";
  return [0,2,4].map(i => (parseInt(value.slice(i,i+2),16)/255).toFixed(3)).join(" ");
};
function readJpeg(dataUrl?:string|null):JpegImage|null {
  if (!dataUrl || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) return null;
  try {
    const binary=atob(dataUrl.slice(dataUrl.indexOf(",")+1));
    const bytes=Uint8Array.from(binary, character=>character.charCodeAt(0));
    let width=0,height=0;
    for(let i=2;i<bytes.length-9;){
      if(bytes[i]!==0xff){i++;continue;}
      const marker=bytes[i+1]??0;
      if(marker===0xd8||marker===0xd9||marker===0x01||(marker>=0xd0&&marker<=0xd7)){i+=2;continue;}
      const length=((bytes[i+2]??0)<<8)|(bytes[i+3]??0);
      if(length<2)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        height=((bytes[i+5]??0)<<8)|(bytes[i+6]??0);
        width=((bytes[i+7]??0)<<8)|(bytes[i+8]??0);
        break;
      }
      i+=2+length;
    }
    if(!width||!height||width>5000||height>5000)return null;
    let hex="";
    for(const byte of bytes)hex+=byte.toString(16).padStart(2,"0");
    return {width,height,hex};
  } catch { return null; }
}

/** Dependency-free PDF generator. The returned Blob is a real, selectable-text PDF file. */
export function createDocumentPdf(input: DocumentPdfInput): Blob {
  const template = input.template ?? "modern";
  const accent = color(input.accentColor ?? (template==="classic"?"#344a3b":"#245b49"));
  const brand = clean(input.brandName || input.businessName || "Your business");
  const serif = template==="classic" || template==="editorial";
  const darkHeader = template==="bold";
  const pages: string[][] = [];
  let commands: string[] = [];
  const newPage = () => { if(commands.length)pages.push(commands);commands=[]; };
  let y = 790;
  const textAt = (x:number, yy:number, value:string, size=9, bold=false, fill="0.16 0.20 0.17") =>
    `BT ${fill} rg /${serif?(bold?"F4":"F3"):(bold?"F2":"F1")} ${size} Tf ${x} ${yy} Td (${esc(value)}) Tj ET`;
  const logo=readJpeg(input.logoDataUrl);
  const signature=readJpeg(input.signatureDataUrl);
  if(darkHeader)commands.push("0.10 0.16 0.13 rg 0 754 595 88 re f");
  else if(template!=="minimal")commands.push(`${accent} rg 48 752 499 ${template==="classic"?2:3} re f`);
  const brandX=logo?112:48;
  if(logo){
    const scale=Math.min(52/logo.width,38/logo.height);
    const width=logo.width*scale,height=logo.height*scale;
    commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} 48 ${darkHeader?780:770} cm /ImLogo Do Q`);
  }
  const headingColor=darkHeader?"1 1 1":accent;
  commands.push(textAt(brandX,810,brand,template==="editorial"?23:template==="classic"?18:19,true,headingColor));
  wrap(input.businessAddress||"",68).slice(0,2).forEach((v,i)=>commands.push(textAt(brandX,735-i*12,v,8,false,darkHeader?"0.86 0.90 0.87":"0.38 0.42 0.39")));
  if(input.vatNumber)commands.push(textAt(brandX,707,"VAT registration: "+input.vatNumber,8,false,darkHeader?"0.86 0.90 0.87":"0.30 0.35 0.31"));
  commands.push(textAt(400,810,input.type==="invoice"?"INVOICE":"QUOTATION",template==="editorial"?19:15,true,headingColor));
  commands.push(textAt(400,790,input.number,10,true,darkHeader?"1 1 1":"0.16 0.20 0.17"));
  commands.push(textAt(400,772,"Issued  "+input.issueDate,8,false,darkHeader?"0.86 0.90 0.87":"0.30 0.35 0.31"));
  commands.push(textAt(400,758,(input.type==="invoice"?"Due  "+(input.dueDate??""):"Valid until  "+(input.validUntil??"")),8,false,darkHeader?"0.86 0.90 0.87":"0.30 0.35 0.31"));
  commands.push(textAt(48,674,input.type==="invoice"?"BILL TO":"PREPARED FOR",8,true,accent));
  commands.push(textAt(48,657,input.customerName,11,true));
  if(input.customerCompany)commands.push(textAt(48,643,input.customerCompany,9));
  if(input.customerEmail)commands.push(textAt(48,629,input.customerEmail,8));
  commands.push("0.91 0.93 0.91 RG 48 606 m 547 606 l S");
  commands.push(textAt(48,588,"DESCRIPTION",8,true,accent));
  commands.push(textAt(380,588,"QTY",8,true,accent));
  commands.push(textAt(430,588,"UNIT PRICE",8,true,accent));
  commands.push(textAt(505,588,"TOTAL",8,true,accent));
  y=568;
  const breakdown=calculateDocumentTax(input.lineItems);
  for(const item of breakdown.lines){
    const rows=wrap(item.description,48);
    if(y<100){commands.push(textAt(48,42,"Continued on next page",7,false,"0.45 0.48 0.46"));newPage();y=790;}
    commands.push(textAt(48,y,rows[0]!,8));
    commands.push(textAt(380,y,String(item.quantity),8));
    commands.push(textAt(430,y,money(item.unitPriceMinor,input.currency),8));
    commands.push(textAt(505,y,money(item.quantity*item.unitPriceMinor,input.currency),8));
    y-=15;
    for(const continuation of rows.slice(1)){commands.push(textAt(48,y,continuation,8));y-=12;}
    commands.push(`0.91 0.93 0.91 RG 48 ${y+5} m 547 ${y+5} l S`);
    y-=5;
  }
  if(y<190){newPage();y=790;}
  const totalX=385;
  commands.push(textAt(totalX,y-8,"Subtotal",9));
  commands.push(textAt(490,y-8,money(breakdown.netMinor,input.currency),9));
  commands.push(textAt(totalX,y-26,"VAT",9));
  commands.push(textAt(490,y-26,money(breakdown.taxMinor,input.currency),9));
  commands.push(`${accent} rg 380 ${y-38} 167 1.5 re f`);
  commands.push(textAt(totalX,y-60,"TOTAL",11,true,accent));
  commands.push(textAt(480,y-60,money(breakdown.grossMinor,input.currency),11,true,accent));
  if(signature){
    if(y<145){newPage();y=790;}
    commands.push(textAt(48,y-105,"CLIENT APPROVAL",8,true,accent));
    const scale=Math.min(150/signature.width,42/signature.height);
    const width=signature.width*scale,height=signature.height*scale;
    commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} 48 ${y-160} cm /ImSignature Do Q`);
    commands.push(textAt(48,y-174,"Signed by "+(input.signerName||"Client"),8));
    if(input.decisionAt)commands.push(textAt(48,y-188,"Signed "+new Date(input.decisionAt).toLocaleString("en-ZA"),7,false,"0.45 0.48 0.46"));
    if(input.agreementAt)commands.push(textAt(48,y-201,"Scope and terms accepted "+new Date(input.agreementAt).toLocaleString("en-ZA"),7,false,"0.45 0.48 0.46"));
  }
  commands.push(textAt(48,42,"Prepared with Invoqly",7,false,"0.48 0.52 0.49"));
  pages.push(commands);

  const objects:string[]=[];
  const add=(value:string)=>{objects.push(value);return objects.length;};
  const catalogId=add("");
  const pagesId=add("");
  const fontRegular=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const fontSerif=add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
  const fontSerifBold=add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>");
  const addImage=(image:JpegImage)=>add(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${image.hex.length+1} >>\nstream\n${image.hex}>\nendstream`);
  const logoId=logo?addImage(logo):null;
  const signatureId=signature?addImage(signature):null;
  const pageIds:number[]=[];
  for(const page of pages){
    const stream=page.join("\n");
    const contentId=add(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const xobjects=[logoId?"/ImLogo "+logoId+" 0 R":null,signatureId?"/ImSignature "+signatureId+" 0 R":null].filter(Boolean).join(" ");
    const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontSerif} 0 R /F4 ${fontSerifBold} 0 R >> /XObject << ${xobjects} >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+" 0 R").join(" ")}] /Count ${pageIds.length} >>`;
  let output="%PDF-1.4\n";
  const offsets=[0];
  objects.forEach((object,index)=>{offsets.push(new TextEncoder().encode(output).length);output+=`${index+1} 0 obj\n${object}\nendobj\n`;});
  const xref=new TextEncoder().encode(output).length;
  output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset=>{output+=String(offset).padStart(10,"0")+" 00000 n \n";});
  output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([output],{type:"application/pdf"});
}
