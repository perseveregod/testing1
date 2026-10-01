import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { Ambient } from "@/components/ui/Ambient";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const DESCRIPTION =
  "See incidents near you, report what you see, and get alerts for the places you care about. Free to use, with an optional one-time upgrade.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Haven: local safety alerts", template: "%s · Haven" },
  description: DESCRIPTION,
  // Open Graph and Twitter cards apply to every route; the generated
  // opengraph-image / twitter-image files (1200×630) are picked up automatically.
  openGraph: {
    type: "website",
    siteName: "Haven",
    title: "Haven: local safety alerts",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Haven: local safety alerts",
    description: DESCRIPTION,
  },
  applicationName: "Haven",
  appleWebApp: { capable: true, title: "Haven", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0d13",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Ambient />
        <div className="relative z-[1] min-h-full">
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}
