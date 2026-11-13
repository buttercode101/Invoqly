"use client";

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DocumentSettings } from "@/lib/document-design";

export type PdfLine = { description: string; quantity: number; unitPriceMinor: number };
export type DocumentPdfProps = {
  kind: "Invoice" | "Quotation";
  number: string;
  businessName: string;
  customerName: string;
  customerCompany?: string;
  customerEmail?: string;
  currency: string;
  issueDate: string;
  dueLabel: string;
  status?: string;
  lineItems: PdfLine[];
  settings: DocumentSettings;
  notes?: string;\n  signatureDataUrl?: string | null;\n  signerName?: string | null;\n  decisionAt?: string | null;
};

const money = (minor: number, currency: string) => {
  try { return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(minor / 100); }
  catch { return currency + " " + (minor / 100).toFixed(2); }
};

export function DocumentPdf(props: DocumentPdfProps) {
  const settings = props.settings;
  const accent = settings.accentColor;
  const template = settings.templateId;
  const darkHeader = template === "bold";
  const serif = template === "classic" || template === "editorial";
  const compact = template === "minimal" || template === "custom";
  const styles = StyleSheet.create({
    page: { paddingTop: 46, paddingHorizontal: 46, paddingBottom: 64, fontFamily: serif ? "Times-Roman" : "Helvetica", fontSize: 10, color: "#202923", backgroundColor: "#ffffff" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: compact ? 16 : 24, marginBottom: compact ? 22 : 30, borderBottomWidth: template === "minimal" ? 0 : 2, borderBottomColor: accent },
    brandBlock: { flex: 1, paddingRight: 20 },
    logo: { width: 78, height: 48, objectFit: "contain", marginBottom: 9 },
    brand: { fontSize: template === "editorial" ? 24 : 18, fontWeight: "bold", color: darkHeader ? "#ffffff" : accent },
    meta: { alignItems: "flex-end", minWidth: 130 },
    kind: { fontSize: template === "editorial" ? 25 : 20, fontWeight: "bold", color: darkHeader ? "#ffffff" : "#18231d", letterSpacing: template === "classic" ? 1.5 : 0 },
    muted: { color: "#748078", fontSize: 9, lineHeight: 1.5, marginTop: 4 },
    headerDark: { backgroundColor: "#1d2b24", marginTop: -46, marginHorizontal: -46, paddingTop: 46, paddingHorizontal: 46, paddingBottom: 28, marginBottom: 30 },
    columns: { flexDirection: "row", justifyContent: "space-between", gap: 24, marginBottom: 28 },
    section: { flex: 1 },
    label: { fontSize: 8, fontWeight: "bold", color: "#87928a", letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase" },
    customer: { fontSize: 13, fontWeight: "bold", color: "#202923", marginBottom: 4 },
    table: { marginTop: 8 },
    tableHead: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1.5, borderBottomColor: accent },
    row: { flexDirection: "row", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#e8ece8" },
    desc: { flex: 4, paddingRight: 12 },
    qty: { width: 42, textAlign: "right" },
    rate: { width: 105, textAlign: "right" },
    amount: { width: 110, textAlign: "right" },
    totals: { marginTop: 18, alignItems: "flex-end" },
    totalRow: { width: 220, flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
    grand: { width: 220, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: accent, paddingTop: 11, marginTop: 6, fontSize: 15, fontWeight: "bold", color: accent },
    notes: { marginTop: 28, padding: 14, backgroundColor: "#f5f7f4", borderLeftWidth: 3, borderLeftColor: accent, lineHeight: 1.55, color: "#536158" },
    signature: { marginTop: 26, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#e8ece8" },\n    signatureImage: { width: 150, height: 54, objectFit: "contain", marginTop: 7 },\n    footer: { position: "absolute", bottom: 28, left: 46, right: 46, borderTopWidth: 1, borderTopColor: "#e8ece8", paddingTop: 9, color: "#929b94", fontSize: 8, textAlign: "center" },
  });
  const totalMinor = props.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
  const brand = settings.brandName.trim() || props.businessName;
  return (
    <Document title={props.number + " · " + props.kind} author={brand}>
      <Page size="A4" style={styles.page} wrap>
        <View style={[styles.header, darkHeader ? styles.headerDark : {}]}>
          <View style={styles.brandBlock}>
            {settings.logoDataUrl ? <Image src={settings.logoDataUrl} style={styles.logo} /> : null}
            <Text style={styles.brand}>{brand}</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.kind}>{props.kind.toUpperCase()}</Text>
            <Text style={styles.muted}>{props.number}</Text>
            <Text style={styles.muted}>Issued {props.issueDate}</Text>
            <Text style={styles.muted}>{props.dueLabel}</Text>
          </View>
        </View>
        <View style={styles.columns}>
          <View style={styles.section}>
            <Text style={styles.label}>Prepared for</Text>
            <Text style={styles.customer}>{props.customerName}</Text>
            {props.customerCompany ? <Text style={styles.muted}>{props.customerCompany}</Text> : null}
            {props.customerEmail ? <Text style={styles.muted}>{props.customerEmail}</Text> : null}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Document status</Text>
            <Text style={{ color: accent, fontSize: 12, fontWeight: "bold" }}>{props.status || "Draft"}</Text>
            <Text style={styles.muted}>{props.currency}</Text>
          </View>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.desc, styles.label]}>Description</Text>
            <Text style={[styles.qty, styles.label]}>Qty</Text>
            <Text style={[styles.rate, styles.label]}>Unit price</Text>
            <Text style={[styles.amount, styles.label]}>Amount</Text>
          </View>
          {props.lineItems.map((item, index) => (
            <View style={styles.row} key={index} wrap={false}>
              <Text style={styles.desc}>{item.description}</Text>
              <Text style={styles.qty}>{item.quantity}</Text>
              <Text style={styles.rate}>{money(item.unitPriceMinor, props.currency)}</Text>
              <Text style={styles.amount}>{money(item.quantity * item.unitPriceMinor, props.currency)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text>{money(totalMinor, props.currency)}</Text></View>
          <View style={styles.grand}><Text>Total</Text><Text>{money(totalMinor, props.currency)}</Text></View>
        </View>
        {props.notes ? <Text style={styles.notes}>{props.notes}</Text> : null}
        <Text style={styles.footer} fixed>{brand} · Prepared with Invoqly</Text>
      </Page>
    </Document>
  );
}
