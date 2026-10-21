import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "GEKI Academy — Master the Art. Build the Spirit.",
    template: "%s | GEKI Academy",
  },
  description:
    "Authentic Kyokushin education. Detailed lessons, structured courses, and focused learning.",
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
