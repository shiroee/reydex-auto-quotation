import type { Metadata, Viewport } from "next";
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
    default: "Reydex Quotations",
    template: "%s · Reydex Quotations",
  },
  description:
    "Quotation system for Reydex Fire Extinguisher Trading — prepare, price, and issue customer quotations.",
};

export const viewport: Viewport = {
  // The app is styled for the dark brand surface; tell the UA so form controls
  // and scrollbars match instead of rendering light chrome.
  colorScheme: "dark",
  themeColor: "#060402",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
