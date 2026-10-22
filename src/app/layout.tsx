import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://geki-academy.vercel.app"),
  applicationName: "GEKI Academy",
  title: {
    default: "GEKI Academy — Master the Art. Build the Spirit.",
    template: "%s | GEKI Academy",
  },
  description:
    "Learn authentic Kyokushin Karate with detailed video lessons, structured courses, progress tracking, and quizzes. English instruction with English and Burmese subtitles.",
  category: "Education",
  icons: {
    icon: [
      { url: "/brand/geki-symbol-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/brand/geki-symbol-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/brand/geki-symbol-light.svg",
  },
  openGraph: {
    type: "website",
    siteName: "GEKI Academy",
    title: "GEKI Academy — Master the Art. Build the Spirit.",
    description: "Authentic Kyokushin Karate education through detailed video lessons and structured courses. Traditional spirit. Modern science. Limitless growth.",
    images: [{ url: "/images/hero.jpg", alt: "GEKI Academy — Kyokushin Karate education" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GEKI Academy — Master the Art. Build the Spirit.",
    description: "Learn authentic Kyokushin Karate through detailed video lessons and structured courses.",
    images: ["/images/hero.jpg"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Noto+Sans+Myanmar:wght@400;500;600&family=Noto+Sans+JP:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
