import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tech News Hub — Agregador Inteligente de Notícias",
  description:
    "Agregador self-hosted moderno de notícias sobre IA, Hardware, Dev, Linux, Open Source e Tecnologia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-300`}
      >
        {children}
      </body>
    </html>
  );
}
