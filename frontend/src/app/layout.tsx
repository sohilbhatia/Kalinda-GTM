import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";

const sfPro = localFont({
  src: [
    { path: "../fonts/SF-Pro-Display-Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/SF-Pro-Display-Medium.otf", weight: "500", style: "normal" },
    { path: "../fonts/SF-Pro-Display-Semibold.otf", weight: "600", style: "normal" },
    { path: "../fonts/SF-Pro-Display-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-sf-pro",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Kalinda",
  description: "PACER prospect search and research tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sfPro.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-sf-pro)]">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
