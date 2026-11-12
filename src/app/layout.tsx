import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";
import PwaInstall from "./pwa-install";
export const metadata: Metadata = { title: { default: "Invoqly — Business, in good order.", template: "%s · Invoqly" }, description: "A clearer way to run the financial side of your business. Invoices, clients and cash flow in one considered workspace.", applicationName: "Invoqly", manifest: "/manifest.webmanifest", metadataBase: new URL("https://invoqly.xyz"), openGraph: { title: "Invoqly — Business, in good order.", description: "A clearer way to run the financial side of your business.", siteName: "Invoqly", type: "website" } };
export const viewport: Viewport = { themeColor: "#f5f6f2", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><PwaRegister/><PwaInstall/>{children}</body></html>; }