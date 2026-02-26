import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXCOM Exchange",
  description: "Next-Generation Commodity Exchange - Trade agricultural commodities, precious metals, energy, and carbon credits",
  manifest: "/manifest.json",
  icons: { apple: "/icon-192.png" },
  keywords: ["commodity exchange", "trading", "NEXCOM", "agriculture", "gold", "energy", "carbon credits"],
  authors: [{ name: "NEXCOM Exchange" }],
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-900">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
