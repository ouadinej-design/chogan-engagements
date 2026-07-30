import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mes Engagements — Chogan",
  description: "Suivi des engagements des consultantes Chogan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
