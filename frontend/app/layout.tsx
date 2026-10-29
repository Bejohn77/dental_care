import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medico Dental Care",
  description: "Dental care website and clinic management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}