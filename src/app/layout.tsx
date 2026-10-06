import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteAnalytics } from "@/components/site-analytics";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "EduCard Pro",
  description: "Professional ID Card Creation & Verification Platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
