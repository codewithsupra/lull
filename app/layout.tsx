import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Unbounded, Noto_Sans_Devanagari, Baloo_2 } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { getMessages } from "@/lib/i18n/server";
import { LOCALE_META } from "@/lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["400", "600", "900"] });

// Devanagari faces sit at the END of each font stack in globals.css, so Latin text keeps the
// brand faces and Hindi text is never left to a system fallback. `preload: false` keeps these
// off the critical path for readers who never render a Devanagari glyph.
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "500", "600", "700"], preload: false });
const devaDisplay = Baloo_2({ variable: "--font-deva-display", subsets: ["devanagari"], weight: ["600", "700", "800"], preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getMessages();
  const alternates = Object.fromEntries(Object.entries(LOCALE_META).map(([code, meta]) => [meta.tag, `/?lang=${code}`]));
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: t.meta.title,
    description: t.meta.description,
    alternates: { languages: alternates },
    openGraph: { title: t.meta.title, description: t.meta.ogDescription, type: "website", locale: LOCALE_META[locale].tag },
  };
}

export const viewport: Viewport = { themeColor: "#03050b" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getMessages()).locale;
  return (
    <html
      lang={LOCALE_META[locale].tag}
      className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable} ${deva.variable} ${devaDisplay.variable} antialiased`}
    >
      <body className="grain min-h-dvh">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
