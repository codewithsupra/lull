import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["400", "600", "900"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Lull — Calm, composed for you",
  description:
    "An AI-composed meditation studio. Tell Lull how you feel and it writes a guided session, breath pattern and real-time generative soundscape just for this moment.",
  openGraph: {
    title: "Lull — Calm, composed for you",
    description: "AI-composed meditations, generative soundscapes and guided breathwork.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#03050b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable} antialiased`}>
      <body className="grain min-h-dvh">{children}</body>
    </html>
  );
}
