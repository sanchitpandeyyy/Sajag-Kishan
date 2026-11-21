import type { Metadata } from "next";
import { Anek_Devanagari, Mukta } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const anek = Anek_Devanagari({ subsets: ["devanagari", "latin"], variable: "--font-anek", display: "swap" });
const mukta = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mukta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "सजग किसान | Sajag Kishan", template: "%s | सजग किसान" },
  description: "Sajag Kishan: land, crop, subsidy and crop-calendar intelligence for Nepal's farmers and agriculture offices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ne" className={`${anek.variable} ${mukta.variable}`}>
      <body className="min-h-dvh antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
