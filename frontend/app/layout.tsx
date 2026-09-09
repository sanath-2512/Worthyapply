import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorthyApply — Make every application worth submitting",
  description:
    "Understand the role. Know your fit. Strengthen your application.",
};

// Runs before first paint to set the theme on <html>, preventing a
// light/dark flash. Priority: saved preference -> system -> default (dark).
// Kept as a compact IIFE string; corrupt/missing values fall back safely.
const THEME_INIT = `(function(){try{var k='worthyapply-theme';var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased noise">{children}</body>
    </html>
  );
}
