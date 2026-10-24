import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODAworx — Creative projects",
  description: "Explore creative work and manage awarded projects.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
