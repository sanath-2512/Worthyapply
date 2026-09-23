import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";
// Tiny editor stylesheet, loaded globally: as its own route chunk it was
// preloaded on "/" (via /builder prefetch) and then flagged as unused.
import "@/components/resume/rich-text.css";

// Self-hosted at build time: no request to Google from the browser, no layout
// shift. Exposed as CSS variables and wired to Tailwind in globals.css.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

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
    { media: "(prefers-color-scheme: light)", color: "#f6f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#060609" },
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
    <html
      lang="en"
      suppressHydrationWarning
      // Tells Next.js to suspend CSS smooth scrolling during route changes.
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="antialiased noise">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
