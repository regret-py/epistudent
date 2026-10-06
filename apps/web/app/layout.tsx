import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { FrameGuard } from "@/components/frame-guard";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const display = Jost({ subsets: ["latin"], weight: ["800", "900"], style: ["italic", "normal"], variable: "--font-display" });

const description =
  "Calculateur de budget étudiant : entre ton budget du mois et l'épargne voulue, on te dit combien dépenser pour la bouffe, les sorties, le transport… par mois, semaine et jour. Gratuit, sans compte.";

export const metadata: Metadata = {
  metadataBase: new URL("https://epistudent.fr"),
  title: { default: "Calculateur budget étudiant : combien pour la bouffe ? — epistudent", template: "%s — epistudent" },
  description,
  referrer: "no-referrer",
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: true, follow: true },
  openGraph: { title: "epistudent — calculateur de budget étudiant", description, url: "https://epistudent.fr", siteName: "epistudent", locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
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
