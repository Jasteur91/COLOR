import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { DEFAULT_ROUNDS } from "@/lib/gameConstants";
import { Analytics } from "@vercel/analytics/next";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dialed — Mémoire des couleurs",
  description: `Jeu ${DEFAULT_ROUNDS} ou 5 manches — couleur ou son, scores perceptuels CIELAB et ERB.`,
  verification: {
    google: "SA8cv8LFrKnTM7cUedHvdf4Oy_2iXxhUn7BGn7_FWzY",
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ACCOUNT
    ? {
        other: {
          "google-adsense-account":
            process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ACCOUNT,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="h-full">
      <body
        className={`${display.variable} ${body.variable} ${geistMono.variable} min-h-full antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
