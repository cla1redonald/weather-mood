import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weather Mood",
  description: "Pick a city and watch its live weather painted as moving generative art, with a poem written for the place and read aloud over music.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-black">{children}</body>
    </html>
  );
}
