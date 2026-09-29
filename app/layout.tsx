import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WCR Pessoas | Gestão de RH",
  description: "Pessoas, equipes e admissões da WCR Saneamento.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
