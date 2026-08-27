import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorthyApply — Make every application worth submitting",
  description:
    "Understand the role. Know your fit. Strengthen your application.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
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
