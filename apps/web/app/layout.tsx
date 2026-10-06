import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { FrameGuard } from "@/components/frame-guard";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const display = Jost({ subsets: ["latin"], weight: ["800", "900"], style: ["italic", "normal"], variable: "--font-display" });

const description =
  "Compteur de budget mensuel pour étudiants : revenus, dépenses, reste à vivre par jour, épargne. Gratuit, sans compte, données chiffrées sur ton appareil.";

export const metadata: Metadata = {
  metadataBase: new URL("https://epistudent.fr"),
  title: { default: "epistudent — budget du mois", template: "%s — epistudent" },
  description,
  referrer: "no-referrer",
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: true, follow: true },
  openGraph: { title: "epistudent — budget du mois", description, url: "https://epistudent.fr", siteName: "epistudent", locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${display.variable} min-h-dvh font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <FrameGuard>{children}</FrameGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
