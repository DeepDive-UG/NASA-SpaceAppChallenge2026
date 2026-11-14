import type { Metadata } from "next";
import { Manrope, DM_Sans } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "latin-ext"], weight: ["300", "400"], variable: "--font-manrope", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = { title: "CropTips", description: "CropTips" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl" className={`${manrope.variable} ${dmSans.variable}`}><body>{children}</body></html>;
}
