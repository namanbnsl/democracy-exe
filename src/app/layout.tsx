import type { Metadata } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "democracy.exe | NPS Koramangala",
  description: "Explore a fictional NPS Koramangala School Prefect election, change the counting rule, and discover the trade-offs in turning individual choices into a collective decision.",
};

// Scales the lesson to fill the screen it is shown on. Landscape screens are laid out as a 1120 × 720 window,
// portrait screens (such as a vertical display) as 760 × 1240; phones keep their normal size.
// Runs before hydration so nothing jumps.
const fitToScreen = `(function () {
  function fit() {
    var w = innerWidth, h = innerHeight;
    var zoom = w < 700 ? 1 : h > w ? Math.min(w / 760, h / 1240) : Math.min(w / 1120, h / 720);
    zoom = Math.max(.8, zoom);
    document.documentElement.style.setProperty("--zoom", zoom.toFixed(3));
  }
  fit();
  addEventListener("resize", fit);
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body>
        <Script id="fit-to-screen" strategy="beforeInteractive">{fitToScreen}</Script>
        {children}
      </body>
    </html>
  );
}
