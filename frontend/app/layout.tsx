import type { Metadata, Viewport } from "next";
import "./globals.css";

const TITLE = "WorthyApply — Make every application worth submitting";
const DESCRIPTION =
  "Check your resume against any job description, see an explainable match score with the evidence behind it, then tailor your resume to the role — using only what you have actually done.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · WorthyApply",
  },
  description: DESCRIPTION,
  applicationName: "WorthyApply",
  keywords: [
    "resume analysis",
    "job description matching",
    "resume tailoring",
    "ATS keywords",
    "resume builder",
  ],
  openGraph: {
    type: "website",
    siteName: "WorthyApply",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#050507" },
  ],
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased noise">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
