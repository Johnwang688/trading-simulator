import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRADESIM — Simulation Trading",
  description: "Simulation trading platform for stocks and options",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-white antialiased">{children}</body>
    </html>
  );
}
