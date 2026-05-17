import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qualitative - Meeting Insights",
  description: "Meeting insights platform for Marker Learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
