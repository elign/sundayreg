import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { siteConfig, assertStorageConfig } from "@/lib/config";
import "./globals.css";

assertStorageConfig();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: `Register once and get your pass for the ${siteConfig.centreName} Sunday program. Show the pass on your phone each Sunday.`,
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
