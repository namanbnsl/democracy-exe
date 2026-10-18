import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "democracy.exe — NPS Koramangala",
  description: "Explore a fictional NPS Koramangala School Prefect election, change the counting rule, and discover the trade-offs in turning individual choices into a collective decision.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
