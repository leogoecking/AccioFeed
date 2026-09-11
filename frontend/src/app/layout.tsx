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
  title: {
    default: "AccioFeed — Leitor Pessoal de Tecnologia",
    template: "%s — AccioFeed",
  },
  description:
    "Agregador e leitor pessoal de tecnologia focado em velocidade, legibilidade editorial e baixo ruído.",
  openGraph: {
    title: "AccioFeed — Leitor Pessoal de Tecnologia",
    description:
      "Agregador e leitor pessoal de tecnologia focado em velocidade, legibilidade editorial e baixo ruído.",
    siteName: "AccioFeed",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-rose-500/30 selection:text-rose-200`}
      >
        {children}
      </body>
    </html>
  );
}
