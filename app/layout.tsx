import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weather Mood",
  description: "A full-screen generative art experience driven by real weather data. Feel the atmosphere with procedural visuals, synthesized audio, and AI-generated poetry.",
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
