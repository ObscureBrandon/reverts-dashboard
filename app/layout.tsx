import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reverts Dashboard",
  description: "Search and analyze Discord bot messages and ticket conversations",
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon-light.png', media: '(prefers-color-scheme: light)', type: 'image/png' },
      { url: '/favicon-dark.png', media: '(prefers-color-scheme: dark)', type: 'image/png' },
    ],
  },
  openGraph: {
    title: "Reverts Dashboard",
    description: "Search and analyze Discord bot messages and ticket conversations",
    images: ['/open-graph.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
