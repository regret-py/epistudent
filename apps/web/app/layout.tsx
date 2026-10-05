import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import fr from "@/lib/i18n/dictionaries/fr";
import "./globals.css";

// Geometric sans with a 900 italic: closest free cut to Futura Heavy Oblique.
const display = Jost({ subsets: ["latin"], weight: ["700", "900"], style: ["italic", "normal"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL("https://epistudent.fr"),
  title: { default: fr.meta.title, template: "%s — epistudent" },
  description: fr.meta.description,
  openGraph: { title: "epistudent", description: fr.meta.description, url: "https://epistudent.fr", siteName: "epistudent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e21d27",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${display.variable} min-h-dvh font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
