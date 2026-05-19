import type { Metadata } from "next";
import { Poltawski_Nowy } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const poltawski = Poltawski_Nowy({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-poltawski",
});

export const metadata: Metadata = {
  title: "Qualitative - Meeting Insights",
  description: "Meeting insights from your customer conversations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poltawski.variable}>
      <body className="antialiased min-h-screen flex flex-col">
        <Providers>
          <div className="flex-grow flex flex-col">{children}</div>
          <SiteFooter />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
