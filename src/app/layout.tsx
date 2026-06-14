import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadGen — Agency Lead Generator",
  description: "Search and manage business leads with Google Places",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
