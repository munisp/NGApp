import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXCOM Exchange",
  description: "Next-Generation Commodity Exchange - Trade agricultural commodities, precious metals, energy, and carbon credits",
  manifest: "/manifest.json",
  icons: { apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-900">
        {children}
      </body>
    </html>
  );
}
