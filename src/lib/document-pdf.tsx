"use client";

import React from "react";
import { pdf } from "@react-pdf/renderer";
import { DocumentPdf, type DocumentPdfProps } from "@/components/document-pdf";

export async function buildDocumentPdfBlob(input: DocumentPdfProps): Promise<Blob> {
  return pdf(<DocumentPdf {...input} />).toBlob();
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDocumentPdf(input: DocumentPdfProps): Promise<void> {
  const blob = await buildDocumentPdfBlob(input);
  const safeNumber = input.number.replace(/[^a-zA-Z0-9-_]/g, "-");
  saveBlob(blob, `${input.kind === "Invoice" ? "Invoice" : "Quotation"}-${safeNumber}.pdf`);
}

export async function shareDocumentPdf(input: DocumentPdfProps): Promise<"shared" | "downloaded"> {
  const blob = await buildDocumentPdfBlob(input);
  const safeNumber = input.number.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filename = `${input.kind === "Invoice" ? "Invoice" : "Quotation"}-${safeNumber}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const data: ShareData = { title: filename, files: [file] };
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    await navigator.share(data);
    return "shared";
  }
  saveBlob(blob, filename);
  return "downloaded";
}
