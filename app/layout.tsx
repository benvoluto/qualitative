import type { Metadata } from "next";
import { Alegreya_Sans, PT_Serif, Fira_Code } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { FloatingBar } from "@/components/floating-bar";
import "./globals.css";

const alegreyaSans = Alegreya_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-alegreya-sans",
});

const ptSerif = PT_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-pt-serif",
});

const firaCode = Fira_Code({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-fira-code",
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
  const fontVars = `${alegreyaSans.variable} ${ptSerif.variable} ${firaCode.variable}`;
  return (
    <html lang="en" className={fontVars}>
      <body className="antialiased min-h-screen flex flex-col font-sans">
        <Providers>
          <div className="flex-grow flex flex-col">{children}</div>
          <FloatingBar />
          <SiteFooter />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
