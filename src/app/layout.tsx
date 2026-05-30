import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apartment renos",
  description: "Field tool for apartment renovation sales and operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
