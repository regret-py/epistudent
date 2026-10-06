import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const display = Jost({ subsets: ["latin"], weight: ["700", "900"], style: ["italic", "normal"], variable: "--font-display" });

const description = "Compteur de budget mensuel pour étudiants : revenus, dépenses, reste à vivre par jour. Gratuit, sans compte, tes données restent sur ton appareil.";

export const metadata: Metadata = {
  metadataBase: new URL("https://epistudent.fr"),
  title: { default: "epistudent — budget du mois", template: "%s — epistudent" },
  description,
  openGraph: { title: "epistudent — budget du mois", description, url: "https://epistudent.fr", siteName: "epistudent" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#e21d27" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${display.variable} min-h-dvh font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
